import type React from 'react';
import { switchUtil } from '../../util/switch-util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReactTag = keyof React.JSX.IntrinsicElements | React.JSXElementConstructor<{ style: any }>;

export type UISpriteSizeWrapperProps<T extends ReactTag = ReactTag> = {
    component: T;
    speciesSize?: 'xs' | 'sm' | 'md' | 'lg' | number;
    itemSize?: '1lh' | 'md' | 'lg' | number;
} & Omit<React.ComponentProps<T>, 'component'>;

const switchIfEnum = function <V extends string>(v: V | number | undefined, o: Record<V, unknown>) {
    return typeof v === 'number'
        ? v
        : typeof v === 'string'
            ? switchUtil(v, o)
            : undefined;
};

export function UISpriteSizeWrapper<T extends ReactTag>({ component: Component, speciesSize, itemSize, style, ...rest }: UISpriteSizeWrapperProps<T>) {
    // A source pixel maps cleanly to the screen at integer device-pixel sizes.
    const getImageRendering = (multiplier: number): React.CSSProperties['imageRendering'] =>
        Number.isInteger(multiplier * devicePixelRatio) ? undefined : 'auto';

    return <Component
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...rest as any}
        style={{
            '--sprite-species-size-multiplier': switchIfEnum(speciesSize, {
                xs: 0.25,
                sm: 0.5,
                md: 1,
                lg: 2,
            }),
            '--sprite-species-rendering': typeof speciesSize === 'number'
                ? getImageRendering(speciesSize)
                : typeof speciesSize === 'string'
                    ? switchUtil(speciesSize, {
                        xs: 'auto',
                        sm: 'auto',
                        md: getImageRendering(1),
                        lg: getImageRendering(2),
                    })
                    : undefined,

            '--sprite-item-size-multiplier': switchIfEnum(itemSize, {
                '1lh': 0.827,
                md: 1,
                lg: 2,
            }),
            '--sprite-item-rendering': typeof itemSize === 'number'
                ? getImageRendering(itemSize)
                : typeof itemSize === 'string'
                    ? switchIfEnum(itemSize, {
                        '1lh': 'auto',
                        md: getImageRendering(1),
                        lg: getImageRendering(2),
                    })
                    : undefined,

            ...style,
        } as React.CSSProperties}
    />;
};
