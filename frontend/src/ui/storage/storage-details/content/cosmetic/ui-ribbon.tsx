import { Box, Tooltip } from '@mantine/core';
import type React from 'react';

export type UIRibbonProps = {
    spriteKey: string;
    name: string;
    count: number;
};

export const UIRibbon: React.FC<UIRibbonProps> = ({ spriteKey, name, count }) => {
    const label = name + (count > 1 ? ` (${count})` : '');
    return <Tooltip label={label}>
        <Box
            component='img'
            mah={30}
            alt={label}
            src={`/imgs/ribbons/${spriteKey}.png`}
        />
    </Tooltip>;
};
