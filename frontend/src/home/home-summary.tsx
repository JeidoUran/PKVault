import { Button, Group, Stack } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { CheckIcon, DownloadIcon } from 'lucide-react';
import homeIcon from '../assets/game_icons/home.png';
import { getApiFullUrl } from '../data/mutator/custom-instance';
import { getHomeDownloadUrl } from '../data/sdk/home/home.gen';
import type { HomeCollectionDTO } from '../data/sdk/model';
import { useTranslate } from '../translate/i18n';
import { UIGameExpandedWrapper } from '../ui/storage/storage-panel/game-list/ui-game-expanded-wrapper';
import { SnapshotCounts } from './snapshot-counts';

export function HomeSaveCard({ collection }: { collection: HomeCollectionDTO }) {
    const { t } = useTranslate();
    const navigate = useNavigate();
    const active = collection.snapshots.find(s => s.id === collection.activeSnapshotId);
    const open = (snapshot?: string) => navigate({ to: '/home', search: { collection: collection.id, snapshot } });
    const valid = collection.snapshots.filter(s => s.isValid);
    const hasHistory = valid.length > 1;
    return <UIGameExpandedWrapper
        label={collection.name}
        imgSrc={homeIcon}
        id={collection.id}
        path={active?.path?.replaceAll('\\', '/') ?? ''}
        onSelect={() => open()}
        secondaryLine={collection.error ?? active?.label ?? t('home.empty')}
        tertiaryLine={active && <SnapshotCounts snapshot={active} />}
        hasDuplicates={hasHistory}
        editLabel={t('home.choose-snapshot')}
        editDropdown={hasHistory && <Stack gap='xs' maw={320} mah={320} style={{ overflowY: 'auto' }}>
            {valid.map(snapshot => <Button key={snapshot.id} variant={snapshot.id === active?.id ? 'light' : 'default'}
                onClick={() => open(snapshot.id)}>
                <Group gap='xs'>
                    {snapshot.id === active?.id && <CheckIcon size={14} />}
                    {snapshot.label} · {t('home.pokemon-count', { count: snapshot.pokemonCount })}
                </Group>
            </Button>)}
        </Stack>}
        actions={active && <Button
            component='a'
            variant='default'
            size='compact-xs'
            fullWidth
            href={getApiFullUrl(getHomeDownloadUrl({ collectionId: collection.id, snapshotId: active.id }))}
            download
            title={t('home.download')}
            aria-label={t('home.download')}
        >
            <DownloadIcon />
        </Button>}
    />;
}
