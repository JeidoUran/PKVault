import type React from 'react';
import { EntityContext } from '../../../data/sdk/model';
import { useStaticData } from '../../../hooks/use-static-data';
import { UIRibbon } from '../../../ui/storage/storage-details/content/cosmetic/ui-ribbon';

type RibbonProps = {
    name: string;
    count: number;
    context: EntityContext;
};

export const Ribbon: React.FC<RibbonProps> = ({ name, count, context }) => {
    const staticData = useStaticData();

    const ribbon = staticData.ribbons[ name ];
    const modernBattleMemory = name === 'RibbonCountMemoryBattle' && count === 7
        && (context === EntityContext.Gen9 || context === EntityContext.Gen9a);
    const spriteKey = ribbon?.sprites[modernBattleMemory ? 8 : count];
    if (!spriteKey)
        return null;

    return <UIRibbon
        spriteKey={spriteKey}
        name={ribbon.name}
        count={count}
    />;
};
