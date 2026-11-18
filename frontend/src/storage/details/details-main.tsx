import { Badge, Group, Tooltip } from '@mantine/core';
import { t } from 'i18next';
import { CircleSmallIcon, DiffIcon } from 'lucide-react';
import type React from 'react';
import { usePkmIndex } from '../../data/hooks/use-pkm-index';
import { usePkmLegality } from '../../data/hooks/use-pkm-legality';
import { type PkmVariantDTO } from '../../data/sdk/model';
import { useStorageMainSetPkmVariantMain } from '../../data/sdk/storage/storage.gen';
import { Route } from '../../routes/storage';
import { UIActionIcon } from '../../ui/form/button/ui-action-icon';
import { UIButton } from '../../ui/form/button/ui-button';
import { UIPopover } from '../../ui/popover/ui-popover';
import { useCurrentStorage } from '../panel/storage-panel-context';
import { DetailsAttachedButton } from './details-attached-button';
import { StorageDetailsDiff } from './diff/storage-details-diff';

import { PokemonDetailsMain } from './pokemon-details-main';

export const DetailsMain: React.FC = () => {
    const { getSelected } = useCurrentStorage();
    const selectedSaveId = Route.useSearch({ select: search => getSelected(search.selected)?.saveId });
    const selectedId = Route.useSearch({ select: search => getSelected(search.selected)?.id });

    const pkmIndexQuery = usePkmIndex(selectedSaveId ?? null, data => data.data.byId[ selectedId ?? '' ]);
    const pkm = pkmIndexQuery.data;

    const pkmLegalityQuery = usePkmLegality(selectedId, selectedSaveId ?? undefined);
    const pkmLegality = pkmLegalityQuery.data?.data;

    const setPkmVariantMainMutation = useStorageMainSetPkmVariantMain();

    if (!pkm)
        return null;

    return <PokemonDetailsMain pkm={pkm}
        saveId={selectedSaveId}
        warning={!!pkmLegality && !pkmLegality.isValid}
        main={!selectedSaveId && <>
            {(pkm as PkmVariantDTO).isMain
                ? <Tooltip label={t('details.main.description')}>
                    <Badge
                        variant='dot'
                        h={22}
                    >
                        {t('details.main')}
                    </Badge>
                </Tooltip>
                : pkm.isEnabled && <Group wrap='nowrap' gap='sm'>
                    <UIPopover
                        position='left'
                        dropdown={<StorageDetailsDiff id={pkm.id} />}
                    >
                        <Tooltip label={t('details.diff')}>
                            <UIActionIcon
                                name='diff-pkm'
                                controlLabel={t('action.select')}
                                variant='default'
                                size='sm'
                                fz='sm'
                            >
                                <DiffIcon />
                            </UIActionIcon>
                        </Tooltip>
                    </UIPopover>

                    <Tooltip label={t('details.main.description')}>
                        <UIButton
                            name='main-pkm'
                            controlLabel={t('action.select')}
                            onClick={() => setPkmVariantMainMutation.mutateAsync({
                                pkmVariantId: pkm.id
                            })}
                            size='compact-xs'
                            leftSection={<CircleSmallIcon />}
                            disabled={!pkm.canEdit}
                        >
                            {t('storage.actions.main')}
                        </UIButton>
                    </Tooltip>
                </Group>}
        </>}
        attachedBtn={<DetailsAttachedButton />}
    />;
};
