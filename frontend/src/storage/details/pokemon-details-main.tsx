import { Tooltip } from '@mantine/core';
import type React from 'react';
import { Gender } from '../../data/sdk/model';
import { useStaticData } from '../../hooks/use-static-data';
import { BallImg } from '../../img/ball-img';
import { ItemImg } from '../../img/item-img';
import { SpeciesImg } from '../../img/species-img';
import { UIMarkingList } from '../../ui/storage/storage-details/marking/ui-marking-list';
import { UIDetailsMain, type UIDetailsMainProps } from '../../ui/storage/storage-details/ui-details-main';
import type { PokemonSummaryData } from './pokemon-summary-data';
import { TypeItem } from './type-item/type-item';

type Props = { pkm: PokemonSummaryData } & Pick<UIDetailsMainProps, 'saveId' | 'warning' | 'main' | 'attachedBtn'>;

export function PokemonDetailsMain({ pkm, ...props }: Props) {
    const staticData = useStaticData();
    const staticForms = staticData.species[pkm.species]?.forms[pkm.context];
    const speciesName = (staticForms?.[pkm.form] ?? staticForms?.[0])?.name ?? '';
    const ballName = pkm.ball != null ? staticData.getItem(pkm.version, pkm.ball)?.name : undefined;

    return <UIDetailsMain
        {...props}
        species={pkm.species}
        speciesName={speciesName}
        gender={pkm.gender}
        isEnabled={pkm.isEnabled}
        isShiny={pkm.isShiny}
        isAlpha={pkm.isAlpha}
        canGigantamax={pkm.canGigantamax}
        isN={pkm.nSparkle}
        types={pkm.types.map(type => <TypeItem key={type} type={type} />)}
        markings={pkm.markings && <UIMarkingList markings={pkm.markings} />}
        teraType={pkm.teraType !== undefined ? <TypeItem type={pkm.teraType} /> : undefined}
        ball={pkm.ball != null && <Tooltip label={ballName} disabled={!ballName}>
            <BallImg item={pkm.ball} />
        </Tooltip>}
        nickname={pkm.nickname}
        level={pkm.level}
        pokerusDays={pkm.pokerusDays}
        isPokerusCured={pkm.isPokerusCured}
        canEvolve={pkm.canEvolve}
        isDuplicate={pkm.isDuplicate}
        heldItem={!!pkm.heldItem && pkm.contextVersion != null
            ? <ItemImg item={pkm.heldItem} version={pkm.contextVersion} />
            : undefined}
    >
        <SpeciesImg
            species={pkm.species}
            context={pkm.context}
            form={pkm.form}
            isFemale={pkm.gender === Gender.Female}
            isShiny={pkm.isShiny}
            isEgg={pkm.isEgg}
            isShadow={pkm.isShadow}
        />
    </UIDetailsMain>;
}
