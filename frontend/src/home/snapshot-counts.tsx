import { Group, NumberFormatter } from '@mantine/core';
import { PackageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { HomeSnapshotDTO } from '../data/sdk/model';
import { useTranslate } from '../translate/i18n';
import { UIPokedexIcons } from '../ui/pokedex/icons/ui-pokedex-icons';

export function SnapshotCounts({ snapshot }: { snapshot: HomeSnapshotDTO }) {
    const { t } = useTranslate();
    const count = (icon: ReactNode, value: number, label: string) =>
        <Group component='span' gap='xs' wrap='nowrap' title={label} aria-label={label}>
            {icon}<NumberFormatter value={value} thousandSeparator=' ' />
        </Group>;

    return <Group component='span' gap='sm' wrap='nowrap'>
        {count(<UIPokedexIcons.Owned size='sm' />, snapshot.pokemonCount, t('home.pokemon-count', { count: snapshot.pokemonCount }))}
        {count(<UIPokedexIcons.Caught size='sm' />, snapshot.speciesCount, t('saves.title.species', { maxSpecies: snapshot.speciesCount }))}
        {count(<UIPokedexIcons.Shiny size='sm' />, snapshot.shinyCount, t('home.shiny-count', { count: snapshot.shinyCount }))}
        {count(<PackageIcon size={14} />, snapshot.boxCount, t('home.box-count', { count: snapshot.boxCount }))}
    </Group>;
}
