import { Group } from '@mantine/core';
import React from 'react';
import { Route } from '../../../../routes/pokedex';

type UIPokedexMainSectionProps = {
    isFirstSection: boolean;
    minSpecies: number;
    maxSpecies: number;
    placeholder?: React.ReactNode;
    children: React.ReactNode;
};

export const UIPokedexMainSection: React.FC<UIPokedexMainSectionProps> = ({
    isFirstSection, minSpecies, maxSpecies, children, placeholder,
}) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [ intersects, setIntersects ] = React.useState<boolean>();
    const [ focused, setFocused ] = React.useState(false);
    const hasPlaceholder = placeholder != null;
    const containsSelected = Route.useSearch({
        select: ({ selected }) => selected != null && selected >= minSpecies && selected <= maxSpecies,
    });

    React.useEffect(() => {
        const section = ref.current;
        if (!section || !hasPlaceholder || typeof IntersectionObserver === 'undefined')
            return;

        const observer = new IntersectionObserver(([ entry ]) => setIntersects(entry?.isIntersecting ?? false), {
            root: section.closest('[data-dex-scroll]'),
            rootMargin: '400px 0px',
        });
        observer.observe(section);
        return () => observer.disconnect();
    }, [ hasPlaceholder ]);

    const showItems = !hasPlaceholder || typeof IntersectionObserver === 'undefined'
        || (intersects ?? isFirstSection) || containsSelected || focused;

    return <Group ref={ref} gap='sm' py='md'
        onFocus={() => setFocused(true)}
        onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget))
                setFocused(false);
        }}
    >
        {showItems ? children : placeholder}
    </Group>;
};
