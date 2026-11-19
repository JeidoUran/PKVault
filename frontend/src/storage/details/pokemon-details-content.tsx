import { Group, Stack } from '@mantine/core';
import type React from 'react';
import { EntityContext, GameVersion, type PkmLegalityDTO } from '../../data/sdk/model';
import { useStaticData } from '../../hooks/use-static-data';
import { ItemImg } from '../../img/item-img';
import { useTranslate } from '../../translate/i18n';
import { UIPokedexIcons } from '../../ui/pokedex/icons/ui-pokedex-icons';
import { UIGameImg } from '../../ui/sprite-img/ui-game-img';
import { UIContest } from '../../ui/storage/storage-details/content/cosmetic/ui-contest';
import { UIDetailsContentCosmetic } from '../../ui/storage/storage-details/content/cosmetic/ui-details-content-cosmetic';
import { UIDetailsContentMisc } from '../../ui/storage/storage-details/content/misc/ui-details-content-misc';
import { UIDetailsContentMove } from '../../ui/storage/storage-details/content/moves/ui-details-content-moves';
import { UIDetailsContentOrigin } from '../../ui/storage/storage-details/content/origin/ui-details-content-origin';
import { UIDetailsContentStats } from '../../ui/storage/storage-details/content/stats/ui-details-content-stats';
import { UIDetailsStatsRow, type UIDetailsStatName } from '../../ui/storage/storage-details/content/stats/ui-details-stats-row';
import { UIDetailsStatsTotalRow } from '../../ui/storage/storage-details/content/stats/ui-details-stats-total-row';
import { UIDetailsContent, type UIDetailsContentProps } from '../../ui/storage/storage-details/content/ui-details-content';
import { UIDetailsContentExpanded } from '../../ui/storage/storage-details/content/ui-details-content-expanded';
import { UIDetailsContentSummary } from '../../ui/storage/storage-details/content/ui-details-content-summary';
import { MoveItem } from './move-item/move-item';
import type { PokemonSummaryData } from './pokemon-summary-data';
import { Ribbon } from './ribbon/ribbon';

const stats = [ 'hp', 'atk', 'def', 'spa', 'spd', 'spe' ] satisfies UIDetailsStatName[];
const total = (values?: number[]) => values?.reduce((sum, value) => sum + value, 0);

type Props = {
    pkm: PokemonSummaryData;
    expanded: boolean;
    fluid?: boolean;
    issues?: React.ReactNode[];
    encounterAnalysis?: string[];
    ribbonContext?: EntityContext;
    storage?: { saveId: number | null; legality: PkmLegalityDTO };
};

export function PokemonDetailsContent({ pkm, expanded, fluid, issues, storage, encounterAnalysis, ribbonContext = pkm.context }: Props) {
    const { t } = useTranslate();
    const data = useStaticData();
    const nature = pkm.nature == null ? undefined : data.natures[pkm.nature];
    const version = pkm.contextVersion == null ? undefined : data.versions[pkm.contextVersion];
    const maxIv = version?.maxIV ?? 31;
    const maxEv = version?.maxEV ?? 252;
    const asDv = pkm.generation != null && pkm.generation < 3;
    const hasBattleStats = pkm.stats != null && pkm.level != null;
    const gameName = data.versions[pkm.version]?.name || (pkm.version === GameVersion.GO ? 'Pokémon GO' : undefined);
    const getMoveRows = (moves?: number[], relearn = false) => moves?.map((move, i) =>
        <MoveItem
            key={i}
            pkmId={storage ? pkm.id : undefined}
            saveId={storage?.saveId ?? null}
            generation={storage ? undefined : pkm.generation}
            move={move}
            isAlpha={pkm.alphaMove === move}
            isValid={(relearn ? storage?.legality.relearnMovesLegality : storage?.legality.movesLegality)?.[i]}
        />
    );

    const content: UIDetailsContentProps['content'] = [];
    if (issues?.length) content.push({
        name: 'issue',
        label: <><UIPokedexIcons.Warn size='xs' /> {t('details.issues.title')}</>,
        content: <Stack>{issues}</Stack>,
    });
    if (pkm.isEnabled) content.push(
        {
            name: 'summary',
            label: t('details.summary.title'),
            content: <UIDetailsContentSummary
                id={pkm.id}
                heldItem={pkm.generation !== 1 && pkm.heldItem != null && pkm.contextVersion != null
                    ? (pkm.heldItem > 0
                        ? <Group gap={4}>
                            <ItemImg item={pkm.heldItem} version={pkm.contextVersion} />
                            {data.getItem(pkm.contextVersion, pkm.heldItem)?.name ?? '???'}
                        </Group>
                        : '-')
                    : undefined}
                nature={asDv ? undefined : nature?.name}
                ability={pkm.ability ? data.abilities[pkm.ability]?.name : undefined}
                specialAbility={pkm.generation === 3}
                isAbilityHidden={pkm.isAbilityHidden}
                pid={pkm.pid}
            />,
        },
        {
            name: 'stats',
            label: t('details.stats.title'),
            content: <UIDetailsContentStats values={hasBattleStats} iv={!!pkm.iVs} ev={!!pkm.eVs} asDv={asDv}>
                {stats.map((stat, i) => <UIDetailsStatsRow
                    key={stat}
                    stat={stat}
                    level={pkm.level}
                    value={hasBattleStats ? (pkm.stats?.[i] ?? 0) : undefined}
                    natureEffect={nature?.decreasedStatIndex === i + 1
                        ? 'decrease'
                        : nature?.increasedStatIndex === i + 1 ? 'increase' : undefined}
                    maxIv={maxIv}
                    maxEv={maxEv}
                    iv={pkm.iVs?.[i]}
                    ev={pkm.eVs?.[i]}
                />)}
                <UIDetailsStatsTotalRow
                    total={hasBattleStats ? total(pkm.stats) : undefined}
                    level={pkm.level}
                    maxIv={maxIv}
                    maxEvTotal={asDv ? 65535 * 6 : 510}
                    iv={total(pkm.iVs)}
                    ev={total(pkm.eVs)}
                />
            </UIDetailsContentStats>,
        },
        ...(pkm.moves ? [{
            name: 'moves',
            label: t('details.moves.title'),
            content: <UIDetailsContentMove moves={getMoveRows(pkm.moves) ?? []} relearnMoves={getMoveRows(pkm.relearnMoves, true)} />,
        }] : []),
        ...(pkm.contest || pkm.ribbons ? [{
            name: 'contest',
            label: t('details.contest'),
            content: <UIDetailsContentCosmetic
                contest={pkm.contest?.map((value, i) => <UIContest key={i} index={i} value={value} />)}
                ribbons={pkm.ribbons && Object.entries(pkm.ribbons).map(([ name, count ]) =>
                    <Ribbon key={name} name={name} count={count} context={ribbonContext} />
                )}
            />,
        }] : []),
        {
            name: 'origin',
            label: t('details.origin'),
            content: <UIDetailsContentOrigin
                game={<Group>
                    <UIGameImg size='1lh' version={pkm.version} name={gameName} />
                    {gameName}
                </Group>}
                ot={pkm.originTrainerName}
                otGender={pkm.originTrainerGender}
                ht={pkm.handlingTrainerName}
                htGender={pkm.handlingTrainerGender}
                tid={pkm.tid}
                sid={pkm.sid}
                originMetLocation={pkm.originMetLocation}
                originMetLevel={pkm.originMetLevel}
                originMetDate={pkm.originMetDate}
                fatefulEncounter={pkm.fatefulEncounter}
                encounterAnalysis={encounterAnalysis}
            />,
        },
        {
            name: 'misc',
            label: t('details.misc.title'),
            content: <UIDetailsContentMisc
                isEgg={pkm.isEgg}
                eggHatchCount={pkm.eggHatchCount ?? 0}
                friendship={pkm.friendship ?? 0}
                language={data.languages[pkm.languageID]}
                homeTracker={pkm.homeTracker}
            />,
        },
    );
    return expanded ? <UIDetailsContentExpanded content={content} fluid={fluid} /> : <UIDetailsContent content={content} />;
}
