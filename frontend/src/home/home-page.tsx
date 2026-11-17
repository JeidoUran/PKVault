import { Accordion, Alert, Badge, Button, Card, Group, Loader, Select, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { homeRescan, homeSelect, useHomeGetAll, useHomeGetPokemon, useHomeGetSnapshot } from '../data/sdk/home/home.gen';
import { GameVersion, Nature, type HomePokemonDTO, type HomeViewDTO } from '../data/sdk/model';
import { useStaticData } from '../hooks/use-static-data';
import { SpeciesImg } from '../img/species-img';
import { Route } from '../routes/home';
import { useTranslate } from '../translate/i18n';
import { UISavesContent } from '../ui/saves/ui-saves-content';
import { UISpriteSizeWrapper } from '../ui/sprite-img/ui-sprite-size-wrapper';
import './home.css';

const gameLabels: Record<string, string> = {
  PB7: "Let's Go", PK8: 'Épée / Bouclier', PA8: 'Légendes Arceus', PB8: 'DE / PS',
  PK9: 'Écarlate / Violet', PA9: 'Légendes Z-A', PC9: 'Champions',
};

export function HomePage() {
  const { t } = useTranslate();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const staticData = useStaticData();
  const queryClient = useQueryClient();
  const collectionsQuery = useHomeGetAll();
  const collections = collectionsQuery.data?.data ?? [];
  const collection = collections.find(c => c.id === search.collection) ?? collections[0];
  const snapshotId = search.snapshot ?? collection?.activeSnapshotId;
  const inventoryQuery = useHomeGetSnapshot({ collectionId: collection?.id ?? '', snapshotId },
    { query: { enabled: !!collection && !!snapshotId } });
  const inventory = inventoryQuery.data?.data;
  const [boxId, setBoxId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState('core');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const boxes = inventory?.boxes ?? [];
  const currentBox = boxes.find(b => b.id === boxId) ?? boxes.find(b => b.pokemon.some(p => p.id === search.entry)) ?? boxes[0];
  const nameOf = (p: HomePokemonDTO) => staticData.species[p.species]?.forms[p.spriteContext]?.[p.form]?.name ?? p.nickname;
  const all = boxes.flatMap(b => b.pokemon);
  const isFiltering = !!filter || !!search.species;
  const visible = isFiltering
    ? all.filter(p => (!search.species || p.species === search.species)
      && `${nameOf(p)} ${p.nickname} ${p.species} ${p.tracker}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    : currentBox?.pokemon ?? [];
  const selected = visible.find(p => p.id === search.entry) ?? visible[0];
  const selectedView = selected?.views.includes(view) ? view : 'core';
  const detailsQuery = useHomeGetPokemon({ collectionId: collection?.id ?? '', snapshotId: snapshotId ?? '',
    entryId: selected?.id ?? '', view: selectedView }, { query: { enabled: !!selected && !!snapshotId } });
  const details = detailsQuery.data?.data;
  const slotGrid = currentBox?.exactSlots && !isFiltering;
  const slots = slotGrid ? Array.from({ length: 30 }, (_, i) => visible.find(p => p.slotIndex === i)) : visible;
  async function update(snapshot: string | null) {
    setBusy(true); setError('');
    try {
      if (snapshot === null) await homeRescan();
      else if (collection) await homeSelect({ collectionId: collection.id, snapshotId: snapshot });
      await queryClient.invalidateQueries();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  return <UISavesContent>
    <Card className='home-content'>
      <Stack gap='md'>
        <Group justify='space-between'>
          <Group><Title order={3}>Pokémon HOME</Title><Badge color='cyan'>{t('home.read-only')}</Badge></Group>
          <Button variant='default' loading={busy} onClick={() => update(null)}>{t('home.refresh')}</Button>
        </Group>
        {(collectionsQuery.isError || inventoryQuery.isError || detailsQuery.isError) && <Alert color='red'>
          {t('home.error')} {String((inventoryQuery.error ?? detailsQuery.error ?? collectionsQuery.error)?.message ?? '')}
        </Alert>}
        {error && <Alert color='red'>{error}</Alert>}
        {collectionsQuery.isPending && <Loader />}
        {!collectionsQuery.isPending && !collections.length && <Alert color='cyan'>{t('home.configure')}</Alert>}
        {collection?.error && <Alert color='red'>{collection.error}</Alert>}
        {collection && <>
          <Group align='end'>
            {collections.length > 1 && <Select label={t('home.collection')} value={collection.id}
              data={collections.map(c => ({ value: c.id, label: c.name }))}
              onChange={v => navigate({ search: { collection: v ?? undefined } })} />}
            <Select label={t('home.snapshot')} value={snapshotId ?? null} w={250}
              data={collection.snapshots.map(s => ({ value: s.id, label: `${s.label} · ${s.pokemonCount} Pokémon`, disabled: !s.isValid }))}
              onChange={v => navigate({ search: { collection: collection.id, snapshot: v ?? undefined } })} />
            {snapshotId && snapshotId !== collection.activeSnapshotId && <Button color='cyan' loading={busy}
              onClick={() => update(snapshotId)}>{t('home.use')}</Button>}
            {!collection.autoSelectLatest && <Button variant='light' loading={busy} onClick={() => update('')}>{t('home.follow-latest')}</Button>}
            <Text size='sm' c='dimmed'>{collection.autoSelectLatest ? t('home.automatic') : t('home.pinned')}</Text>
          </Group>
          {collection.snapshots.filter(s => !s.isValid).map(s => <Alert key={s.id} color='red'>{s.id}: {s.error}</Alert>)}
        </>}
        {inventoryQuery.isPending && inventoryQuery.isEnabled && <Loader />}
        {inventory && <>
          <Group gap='lg'>
            <Text>{inventory.snapshot.pokemonCount} Pokémon</Text><Text>{inventory.snapshot.speciesCount} {t('home.species')}</Text>
            <Text>✦ {inventory.snapshot.shinyCount}</Text><Text>{inventory.snapshot.boxCount} {t('home.boxes')}</Text>
          </Group>
          <Text size='sm' c='dimmed'>{t('home.counting')}</Text>
          {!inventory.snapshot.exactSlots && <Alert color='cyan'>{t('home.positions-unknown')}</Alert>}
          {snapshotId !== collection?.activeSnapshotId && <Alert color='yellow'>{t('home.preview')}</Alert>}
          <Group align='end'>
            <Select label={t('home.box')} searchable value={currentBox?.id ?? null}
              data={boxes.map(b => ({ value: b.id, label: `${b.name} · ${b.pokemon.length}` }))}
              onChange={setBoxId} w={260} disabled={isFiltering} />
            <TextInput label={t('home.search')} value={filter} onChange={e => setFilter(e.currentTarget.value)} />
            {search.species && <Button variant='light' onClick={() => navigate({ search: { ...search, species: undefined } })}>#{search.species} ×</Button>}
            <Text c='dimmed'>{visible.length} Pokémon</Text>
          </Group>
          <div className='home-layout'>
            <UISpriteSizeWrapper component='div' speciesSize='sm' className='home-grid' role='list'>
              {slots.map((p, index) => p ? <button key={p.id} type='button' className='home-slot' role='listitem'
                aria-label={`${nameOf(p)}${p.isShiny ? ' ✦' : ''}`} aria-pressed={selected?.id === p.id}
                onClick={() => navigate({ search: { ...search, collection: collection?.id, entry: p.id } })}>
                <SpeciesImg species={p.species} context={p.spriteContext} form={p.form} isFemale={p.gender === 1} isShiny={p.isShiny} isEgg={p.isEgg} />
                <span>{p.isShiny && <b className='home-shiny'>✦ </b>}{nameOf(p)}</span>
                {isFiltering && <small>{p.box}</small>}
              </button> : <div key={`empty-${index}`} className='home-slot home-empty' />)}
            </UISpriteSizeWrapper>
            <Card withBorder className='home-details'>
              {detailsQuery.isPending && detailsQuery.isEnabled && <Loader />}
              {selected && <Stack gap='sm'>
                <Title order={4}>{nameOf(selected)} {selected.isShiny && '✦'}</Title>
                <Text size='sm' c='dimmed'>{selected.box}{selected.slotIndex != null ? ` · ${selected.slotIndex + 1}/30` : ''}</Text>
                <Tabs value={selectedView} onChange={v => setView(v ?? 'core')}>
                  <Tabs.List>{selected.views.map(v => <Tabs.Tab key={v} value={v}>{v === 'core' ? t('home.common') : gameLabels[v] ?? v}</Tabs.Tab>)}</Tabs.List>
                </Tabs>
                {details && <>
                  <Text size='sm' c='cyan'>{details.view.isProjection ? t('home.projection') : t('home.shared')}</Text>
                  <HomeFields view={details.view} />
                  <Accordion variant='contained'><Accordion.Item value='source'>
                    <Accordion.Control>{t('home.source')}</Accordion.Control><Accordion.Panel>
                      <Text size='xs' style={{ overflowWrap: 'anywhere' }}>{details.sourcePath}<br />SHA-256: {details.sha256}</Text>
                      <pre className='home-hex'>{details.view.blockHex.match(/.{1,32}/g)?.join('\n')}</pre>
                    </Accordion.Panel>
                  </Accordion.Item></Accordion>
                </>}
              </Stack>}
            </Card>
          </div>
        </>}
      </Stack>
    </Card>
  </UISavesContent>;
}

function HomeFields({ view: v }: { view: HomeViewDTO }) {
  const { t } = useTranslate();
  const data = useStaticData();
  const fields: [string, string | number | undefined][] = [
    [t('home.nickname'), v.nickname], [t('home.origin'), data.versions[v.originGame]?.name || (v.originGame === GameVersion.GO ? 'Pokémon GO' : Object.entries(GameVersion).find(([, id]) => id === v.originGame)?.[0] ?? String(v.originGame))],
    ['DO', v.originalTrainer], ['TID / SID', `${v.tid} / ${v.sid}`],
    ['HOME Tracker', v.tracker], ['PID', v.pid.toString(16).toUpperCase().padStart(8, '0')],
    [t('home.level'), v.level], [t('home.nature'), data.natures[Nature[v.nature as keyof typeof Nature]]?.name ?? v.nature],
    [t('home.language'), data.languages[v.language]],
    ['IV (HP / Atk / Def / SpA / SpD / Spe)', v.iVs.join(' / ')],
    ['EV (HP / Atk / Def / SpA / SpD / Spe)', v.eVs?.join(' / ')],
    [t('home.ability'), v.ability == null ? undefined : data.abilities[v.ability]?.name],
    [t('home.moves'), v.moves?.filter(Boolean).map(m => data.moves[m]?.name ?? String(m)).join(' · ')],
    [t('home.met-date'), v.metDate],
  ];
  return <Table><Table.Tbody>{fields.filter(([, value]) => value !== undefined).map(([label, value]) =>
    <Table.Tr key={label}><Table.Td c='dimmed'>{label}</Table.Td><Table.Td style={{ overflowWrap: 'anywhere' }}>{value}</Table.Td></Table.Tr>
  )}</Table.Tbody></Table>;
}
