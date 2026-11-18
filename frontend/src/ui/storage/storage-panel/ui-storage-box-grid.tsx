import { Group } from '@mantine/core';

export function UIStorageBoxGrid({ columns = 0, style, ...props }: Group.Props & { columns?: number }) {
    return <Group
        gap='sm'
        wrap='wrap'
        mx='auto'
        pos='relative'
        w='fit-content'
        {...props}
        style={columns > 0 ? {
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            ...style,
        } : style}
    />;
}
