import { Accordion, Alert, Card, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useState } from 'react';
import { getHomeGetPokemonQueryKey, useHomeGetPokemon } from '../data/sdk/home/home.gen';
import { EntityContext, Nature, type Gender, type HomePokemonDTO, type HomeViewDTO, type LanguageID } from '../data/sdk/model';
import { useSettingsGet } from '../data/sdk/settings/settings.gen';
import { PokemonDetailsContent } from '../storage/details/pokemon-details-content';
import { PokemonDetailsMain } from '../storage/details/pokemon-details-main';
import type { PokemonSummaryData } from '../storage/details/pokemon-summary-data';
import { useTranslate } from '../translate/i18n';

const gameLabels: Record<string, string> = {
    PB7: "Let's Go", PK8: 'Épée / Bouclier', PA8: 'Légendes Arceus', PB8: 'DE / PS',
    PK9: 'Écarlate / Violet', PA9: 'Légendes Z-A', PC9: 'Champions',
};

function getGeneration(context: EntityContext) {
    if (context === EntityContext.Gen7b) return 7;
    if (context === EntityContext.Gen8a || context === EntityContext.Gen8b) return 8;
    if (context === EntityContext.Gen9a) return 9;
    return context || undefined;
}

function summaryData(pokemon: HomePokemonDTO, view: HomeViewDTO): PokemonSummaryData {
    return {
        id: pokemon.id,
        species: view.species,
        form: view.form,
        context: view.spriteContext,
        version: view.originGame,
        contextVersion: view.contextVersion,
        generation: getGeneration(view.context),
        nickname: view.nickname,
        gender: view.gender as Gender,
        isEgg: pokemon.isEgg,
        isEnabled: true,
        isShiny: view.isShiny,
        types: view.types,
        teraType: view.teraType,
        level: view.level,
        ball: view.ball,
        heldItem: view.heldItem,
        isAlpha: view.isAlpha,
        canGigantamax: view.canGigantamax,
        markings: view.markings,
        nature: Nature[view.nature as keyof typeof Nature],
        ability: view.ability,
        isAbilityHidden: view.isAbilityHidden,
        pid: view.pid,
        iVs: view.iVs,
        eVs: view.eVs,
        stats: view.stats,
        moves: view.moves,
        relearnMoves: view.relearnMoves,
        alphaMove: view.alphaMove,
        ribbons: view.ribbons,
        contest: view.contest,
        originTrainerName: view.originalTrainer,
        originTrainerGender: view.originalTrainerGender,
        handlingTrainerName: view.handlingTrainer,
        handlingTrainerGender: view.handlingTrainerGender,
        tid: view.displayTid,
        sid: view.displaySid,
        originMetDate: view.metDate,
        originMetLevel: view.metLevel,
        originMetLocation: view.metLocationName,
        fatefulEncounter: view.fatefulEncounter,
        languageID: view.language as LanguageID,
        homeTracker: view.tracker,
        friendship: view.friendship,
        eggHatchCount: view.eggHatchCount,
    };
}

type Props = { collectionId: string; snapshotId: string; pokemon: HomePokemonDTO; boxName: string };

export function HomeDetails({ collectionId, snapshotId, pokemon, boxName }: Props) {
    const { t, i18n } = useTranslate();
    const [ preferredView, setPreferredView ] = useState('core');
    const view = pokemon.views.includes(preferredView) ? preferredView : 'core';
    const skipLegality = useSettingsGet().data?.data.settingsMutable.skiP_LEGALITY_CHECKS;
    const params = { collectionId, snapshotId, entryId: pokemon.id, view };
    const query = useHomeGetPokemon(params, {
        query: {
            queryKey: [...getHomeGetPokemonQueryKey(params), i18n.language, skipLegality],
        },
    });
    const details = query.data?.data;
    const pkm = details && summaryData(pokemon, details.view);

    return <Card component='aside' withBorder shadow='none' className='home-details'>
        <Card.Section withBorder inheritPadding>
            <Group justify='space-between' align='baseline' gap='xs'>
                <Tabs value={view} onChange={key => setPreferredView(key ?? 'core')}>
                    <Tabs.List>
                        {pokemon.views.map(key => <Tabs.Tab key={key} value={key}>
                            {key === 'core' ? t('home.common') : gameLabels[key] ?? key}
                        </Tabs.Tab>)}
                    </Tabs.List>
                </Tabs>
                <Text size='xs' c='dimmed'>
                    {boxName}{pokemon.slotIndex != null && ' · ' + (pokemon.slotIndex + 1) + '/30'}
                </Text>
            </Group>
        </Card.Section>
        {query.isError && <Alert color='red'>{t('home.error')}</Alert>}
        {query.isPending && <Loader size='sm' my='md' />}
        {details && pkm && <Stack pt='md'>
            <div className='home-details-grid'>
                <PokemonDetailsMain pkm={pkm} />
                <PokemonDetailsContent pkm={pkm} expanded fluid
                    encounterAnalysis={details.view.encounterAnalysis}
                    ribbonContext={details.view.contextVersion == null ? EntityContext.Gen9 : details.view.context}
                />
            </div>
            <Accordion variant='contained' key={view === 'PC9' ? 'raw' : 'details'} defaultValue={view === 'PC9' ? 'source' : undefined}>
                <Accordion.Item value='source'>
                    <Accordion.Control>{view === 'PC9' ? t('home.champions-source') : t('home.source')}</Accordion.Control>
                    <Accordion.Panel>
                        <Text size='xs' style={{ overflowWrap: 'anywhere' }}>{details.sourcePath}<br />SHA-256: {details.sha256}</Text>
                        <pre className='home-hex'>{details.view.blockHex.match(/.{1,32}/g)?.join('\n')}</pre>
                    </Accordion.Panel>
                </Accordion.Item>
            </Accordion>
        </Stack>}
    </Card>;
}
