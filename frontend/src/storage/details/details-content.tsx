import { Alert, Box, Group } from '@mantine/core';
import { AlertCircleIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react';
import React from 'react';
import { usePkmAttachState } from '../../data/hooks/use-pkm-attach-state';
import { usePkmIndex } from '../../data/hooks/use-pkm-index';
import { usePkmLegality } from '../../data/hooks/use-pkm-legality';
import { usePkmVariantAttach } from '../../data/hooks/use-pkm-variant-attach';
import { PKMLoadError, type PkmSaveDTO, type PkmVariantDTO } from '../../data/sdk/model';
import { useSettingsGet } from '../../data/sdk/settings/settings.gen';
import { getStorageGetPkmEncounterQueryKey, useStorageGetPkmEncounter } from '../../data/sdk/storage/storage.gen';
import { withErrorCatcher } from '../../error/with-error-catcher';
import { Route } from '../../routes/storage';
import { useTranslate } from '../../translate/i18n';
import { UIPathLine } from '../../ui/path/ui-path-line';
import { UIPokedexIcons } from '../../ui/pokedex/icons/ui-pokedex-icons';
import { switchUtilRequired } from '../../util/switch-util';
import { useCurrentStorage } from '../panel/storage-panel-context';
import { useStorageSelectExpanded } from './hooks/use-storage-select-expanded';

import { PokemonDetailsContent } from './pokemon-details-content';

const isVariant = (pkm: PkmVariantDTO | PkmSaveDTO) => 'filepath' in pkm;

export const DetailsContent: React.FC = withErrorCatcher('default', () => {
    const { t, i18n } = useTranslate();

    const { expanded } = useStorageSelectExpanded();

    const { getSelected } = useCurrentStorage();
    const selectedSaveId = Route.useSearch({ select: search => getSelected(search.selected)?.saveId }) ?? null;
    const selectedId = Route.useSearch({ select: search => getSelected(search.selected)?.id });

    const pkmIndexQuery = usePkmIndex(selectedSaveId, data => data.data.byId[ selectedId ?? '' ]);
    const pkm = pkmIndexQuery.data;
    const skipLegality = useSettingsGet().data?.data.settingsMutable.skiP_LEGALITY_CHECKS;
    const encounterParams = { pkmId: selectedId ?? '', saveId: selectedSaveId };
    const encounterQuery = useStorageGetPkmEncounter(encounterParams, {
        query: {
            enabled: !!pkm?.isEnabled && skipLegality === false,
            queryKey: [
                ...getStorageGetPkmEncounterQueryKey(encounterParams),
                pkm?.dynamicChecksum,
                pkm && isVariant(pkm) ? pkm.attachedSaveId : undefined,
                i18n.language,
            ],
        },
    });

    const getPkmVariantAttach = usePkmVariantAttach();

    const pkmLegalityQuery = usePkmLegality(selectedId, selectedSaveId ?? undefined);
    const pkmLegality = pkmLegalityQuery.data?.data;

    const attachStateQuery = usePkmAttachState(selectedSaveId, selectedId);
    const attachState = attachStateQuery.data;

    if (!pkm || !pkmLegality)
        return null;

    const issues: React.ReactNode[] = [
        isVariant(pkm) && pkm.isExternal && <Alert
            variant='default' title={<Group wrap='nowrap'>
                <InfoIcon />
                {t('details.external-pkm-file.title')}
            </Group>}
        >
            <ExternalLinkIcon />{' '}
            {t('details.external-pkm-file.1')}
            <UIPathLine>{pkm.filepathAbsolute}</UIPathLine>
            <br />
            {t('details.external-pkm-file.2')}
        </Alert>,
        !pkm.isEnabled && <Alert variant='outline' color='red'
            title={<Group wrap='nowrap'>
                <AlertCircleIcon />
                {t('details.is-disabled.title')}
            </Group>}
        >
            {t('details.is-disabled')}
        </Alert>,
        isVariant(pkm) && pkm.loadError && <Alert
            variant='outline' color='red'
            title={<Group wrap='nowrap'>
                <AlertCircleIcon />
                {t('details.load-error.title')}
            </Group>}
        >
            {pkm.loadError && t('details.load-error', {
                loadError: switchUtilRequired(pkm.loadError, {
                    [ PKMLoadError.UNKNOWN ]: t('details.load-error.0'),
                    [ PKMLoadError.NOT_LOADED ]: t('details.load-error.0'),
                    [ PKMLoadError.NOT_FOUND ]: t('details.load-error.1'),
                    [ PKMLoadError.TOO_SMALL ]: t('details.load-error.2'),
                    [ PKMLoadError.TOO_BIG ]: t('details.load-error.3'),
                    [ PKMLoadError.UNAUTHORIZED ]: t('details.load-error.4'),
                }),
                filepath: pkm.filepath,
            })}
        </Alert>,
        isVariant(pkm) && pkm.isEnabled && !getPkmVariantAttach(pkm, pkm.id).isAttachedValid && <Alert
            variant='outline' color='orange'
            title={<Group wrap='nowrap'>
                <UIPokedexIcons.Warn size='xs' />
                {t('details.attached-pkm-not-found.1')}
            </Group>}
        >
            {t('details.attached-pkm-not-found.1')}
            <br />
            <br />
            {t('details.attached-pkm-not-found.2')}
        </Alert>,
        attachState.attachBroken && attachState.attachBrokenReason === 'isDuplicate' && !attachState.targetAnotherPkmId && <Alert
            variant='outline' color='orange'
            title={<Group wrap='nowrap'>
                <UIPokedexIcons.Attached attachBroken size='xs' />
                {t('details.attached-broken.1')}
            </Group>}
        >
            {t('details.attached-broken.2')}
            <Group wrap='nowrap' my='sm'>
                <UIPokedexIcons.Duplicate size='xs' /> {t('details.attached-broken.3')}
            </Group>
            {t('details.attached-broken.4')}
        </Alert>,
        pkm.isEnabled && pkmLegality && pkmLegality.illegalitiesCount > 0 && pkmLegality.validityReport && <Alert
            variant='outline' color='orange'
            title={<Group wrap='nowrap'>
                <UIPokedexIcons.Warn size='xs' />
                {t('details.legality.1')}
            </Group>}
        >
            <Box style={{ whiteSpace: 'break-spaces' }}>
                {pkmLegality.validityReport}
            </Box>
            <br />
            {t('details.legality.2')}
        </Alert>,
    ].filter(Boolean);

    return <PokemonDetailsContent
        pkm={pkm}
        expanded={expanded}
        encounterAnalysis={skipLegality ? undefined : encounterQuery.data?.data}
        issues={issues.map((issue, i) => <React.Fragment key={i}>{issue}</React.Fragment>)}
        storage={{ saveId: selectedSaveId, legality: pkmLegality }}
    />;
});
