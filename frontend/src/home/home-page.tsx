import { ActionIcon, Alert, Button, Card, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, RefreshCwIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getApiFullUrl } from '../data/mutator/custom-instance';
import { getHomeDownloadUrl, homeRescan, homeSelect, useHomeGetAll, useHomeGetSnapshot } from '../data/sdk/home/home.gen';
import type { HomePokemonDTO } from '../data/sdk/model';
import { useStaticData } from '../hooks/use-static-data';
import { Route } from '../routes/home';
import { useTranslate } from '../translate/i18n';
import { SnapshotCounts } from './snapshot-counts';
import { HomeBox } from './home-box';
import { HomeDetails } from './home-details';
import { refreshHomeQueries } from './refresh-home-queries';
import './home.css';

export function HomePage() {
    const { t } = useTranslate();
    const navigate = Route.useNavigate();
    const search = Route.useSearch();
    const { species } = useStaticData();
    const client = useQueryClient();
    const collectionsQuery = useHomeGetAll();
    const collections = collectionsQuery.data?.data ?? [];
    const collection = collections.find(c => c.id === search.collection) ?? collections[0];
    const snapshotId = search.snapshot ?? collection?.activeSnapshotId;
    const inventoryQuery = useHomeGetSnapshot({ collectionId: collection?.id ?? '', snapshotId },
        { query: { enabled: !!collection && !!snapshotId } });
    const inventory = inventoryQuery.data?.data;
    const [ boxId, setBoxId ] = useState<string | null>(null);
    const [ filter, setFilter ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState('');

    const speciesName = (p: HomePokemonDTO) =>
        species[p.species]?.forms[p.spriteContext]?.[p.form]?.name || p.nickname || '#' + p.species;
    const index = useMemo(() => {
        const byId = new Map<string, HomePokemonDTO>();
        const options = inventory?.boxes.map(b => {
            for (const p of b.pokemon) byId.set(p.id, p);
            return { value: b.id, label: b.name };
        }) ?? [];
        return { byId, options };
    }, [ inventory ]);
    const boxes = inventory?.boxes ?? [];
    const requestedPokemon = index.byId.get(search.entry ?? '');
    const currentBox = boxes.find(b => b.id === boxId)
        ?? boxes.find(b => b.id === requestedPokemon?.box) ?? boxes[0];
    const term = filter.trim().toLocaleLowerCase();
    const results = term || search.species
        ? Array.from(index.byId.values()).filter(p => (!search.species || p.species === search.species)
            && (!term || (speciesName(p) + ' ' + p.nickname + ' ' + p.species + ' ' + p.tracker).toLocaleLowerCase().includes(term)))
        : undefined;
    const visible = results ?? currentBox?.pokemon;
    const selected = visible?.find(p => p.id === search.entry) ?? visible?.[0];
    const selectedBoxName = boxes.find(b => b.id === selected?.box)?.name ?? selected?.box ?? '';
    const preview = snapshotId && snapshotId !== collection?.activeSnapshotId;

    async function update(snapshot: string | null) {
        setBusy(true);
        setError('');
        try {
            if (snapshot === null) await homeRescan();
            else if (collection) await homeSelect({ collectionId: collection.id, snapshotId: snapshot });
            await refreshHomeQueries(client);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    return <Card className='home-content' component='main'>
        <Stack gap='sm'>
            <Group align='end' justify='space-between'>
                <Group align='end' gap='sm'>
                    {collections.length > 1 && <Select
                        label={t('home.collection')}
                        value={collection?.id ?? null}
                        allowDeselect={false}
                        data={collections.map(c => ({ value: c.id, label: c.name }))}
                        onChange={id => {
                            setBoxId(null);
                            void navigate({ search: { collection: id ?? undefined } });
                        }}
                    />}
                    {!!collection?.snapshots.length && <Select
                        label={t('home.snapshot')}
                        value={snapshotId ?? null}
                        allowDeselect={false}
                        data={collection.snapshots.map(s => ({
                            value: s.id, label: s.label, disabled: !s.isValid,
                        }))}
                        onChange={id => {
                            setBoxId(null);
                            void navigate({ search: { collection: collection.id, snapshot: id ?? undefined, species: search.species } });
                        }}
                    />}
                    {preview && <Button variant='light' loading={busy}
                        onClick={() => update(snapshotId)}>{t('home.use')}</Button>}
                    {collection && !collection.autoSelectLatest && <Button variant='default' loading={busy}
                        onClick={() => update('')}>{t('home.follow-latest')}</Button>}
                </Group>
                <Group align='center' gap='md'>
                    {inventory && <SnapshotCounts snapshot={inventory.snapshot} />}
                    {inventory && <ActionIcon component='a' variant='default' size='lg'
                        href={getApiFullUrl(getHomeDownloadUrl({ collectionId: inventory.collectionId, snapshotId: inventory.snapshot.id }))}
                        download aria-label={t('home.download')} title={t('home.download')}><DownloadIcon size={16} /></ActionIcon>}
                    <ActionIcon variant='default' size='lg' aria-label={t('home.refresh')} title={t('home.refresh')}
                        loading={busy} onClick={() => update(null)}><RefreshCwIcon size={16} /></ActionIcon>
                </Group>
            </Group>
            {(collectionsQuery.isError || inventoryQuery.isError) && <Alert color='red'>{t('home.error')}</Alert>}
            {error && <Alert color='red'>{error}</Alert>}
            {collection?.error && <Alert color='red'>{collection.error}</Alert>}
            {collection?.snapshots.filter(s => !s.isValid).map(s => <Alert key={s.id} color='red'>{s.id} · {s.error}</Alert>)}
            {!collectionsQuery.isPending && !collections.length && <Alert>{t('home.configure')}</Alert>}
            {collection && !collection.error && !collection.snapshots.length && <Text c='dimmed'>{t('home.empty')}</Text>}
            {(collectionsQuery.isPending || (inventoryQuery.isPending && inventoryQuery.isEnabled)) && <Loader size='sm' />}
            {preview && <Text size='sm' c='dimmed'>{t('home.preview')}</Text>}
            {search.species && <Group>
                <Button size='compact-xs' variant='light' onClick={() => navigate({ search: { ...search, species: undefined } })}>
                    #{search.species} ×
                </Button>
            </Group>}
            {inventory && snapshotId && <div className='home-layout'>
                <HomeBox
                    key={collection?.id + '/' + snapshotId}
                    boxes={boxes}
                    box={currentBox}
                    results={results}
                    selected={selected}
                    boxOptions={index.options}
                    speciesName={speciesName}
                    filter={filter}
                    setFilter={setFilter}
                    onSelectBox={setBoxId}
                    onSelectPokemon={p => {
                        setBoxId(p.box);
                        void navigate({ search: { ...search, collection: collection?.id, entry: p.id }, replace: true });
                    }}
                />
                {selected && <HomeDetails key={snapshotId} collectionId={inventory.collectionId}
                    snapshotId={snapshotId} pokemon={selected} boxName={selectedBoxName} />}
            </div>}
        </Stack>
    </Card>;
}
