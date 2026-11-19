import { Group } from '@mantine/core';
import React from 'react';
import { UISpeciesImgSkeleton } from '../../ui/sprite-img/species-img/ui-species-img-skeleton';
import { DexFormItem } from './dex-item/dex-form-item';
import type { SpeciesInfos } from './hooks/use-pokedex-items';
import { PokedexItem } from './pokedex-item';

type Props = { speciesInfos: SpeciesInfos[] };

export const GenerationItems = React.memo(({ speciesInfos }: Props) =>
  speciesInfos.map(({ species, speciesName, isSeen, itemsToRender }) =>
    <PokedexItem key={species} species={species} speciesName={speciesName} isSeen={isSeen}>
      {itemsToRender.map(item => <DexFormItem key={item.id} {...item} />)}
    </PokedexItem>
  ));

export const GenerationPlaceholder = React.memo(({ speciesInfos }: Props) =>
  speciesInfos.map(({ species, itemsToRender }) => {
    if (itemsToRender.length === 1)
      return <UISpeciesImgSkeleton key={species} animate={false} visible={false} aria-hidden />;

    return <Group key={species} gap='sm' maw='100%' aria-hidden>
      {itemsToRender.map(item => <UISpeciesImgSkeleton key={item.id} animate={false} visible={false} />)}
    </Group>;
  }));
