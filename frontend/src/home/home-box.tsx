import { Box, Card, Group, Pagination, Select, Text, TextInput, Tooltip } from '@mantine/core';
import { InfoIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import type { HomeBoxDTO, HomePokemonDTO } from '../data/sdk/model';
import { Gender } from '../data/sdk/model';
import { SpeciesImg } from '../img/species-img';
import { useTranslate } from '../translate/i18n';
import { useSpriteSizeLocalStorage } from '../ui/local-storage/use-storage-size-local-storage';
import { UISpriteSizeWrapper } from '../ui/sprite-img/ui-sprite-size-wrapper';
import { UIStorageItemBase } from '../ui/storage/storage-item/base/ui-storage-item-base';
import { UIStorageItemIcons } from '../ui/storage/storage-item/ui-storage-item-icons';
import { UIStorageBoxGrid } from '../ui/storage/storage-panel/ui-storage-box-grid';

export const homeBoxSize = 30;

type Props = {
    boxes: HomeBoxDTO[];
    box?: HomeBoxDTO;
    results?: HomePokemonDTO[];
    selected?: HomePokemonDTO;
    boxOptions: { value: string; label: string }[];
    speciesName: (p: HomePokemonDTO) => string;
    onSelectPokemon: (p: HomePokemonDTO) => void;
    onSelectBox: (id: string | null) => void;
    filter: string;
    setFilter: (text: string) => void;
};

export function HomeBox({ boxes, box, results, selected, boxOptions, speciesName, onSelectPokemon, onSelectBox, filter, setFilter }: Props) {
    const { t } = useTranslate();
    const [ spriteSize ] = useSpriteSizeLocalStorage('home-sprite-size');
    const [ page, setPage ] = useState(1);
    const pageCount = Math.ceil((results?.length ?? 0) / homeBoxSize);
    const visiblePage = Math.min(page, Math.max(1, pageCount));
    const filtered = results?.slice((visiblePage - 1) * homeBoxSize, visiblePage * homeBoxSize);
    const indexedPokemon = new Map(box?.pokemon.map(p => [p.slotIndex ?? p.displayIndex, p]));
    const slots = filtered ?? Array.from({ length: homeBoxSize }, (_, index) => indexedPokemon.get(index));
    const boxNames = new Map(boxes.map(b => [b.id, b.name]));

    return <Card withBorder className='home-box-panel' p='md' shadow='none'>
        <Card.Section withBorder inheritPadding py='sm'>
            <Group align='end' gap='sm'>
                <Select
                    label={t('home.box')}
                    value={box?.id ?? null}
                    data={boxOptions}
                    onChange={onSelectBox}
                    allowDeselect={false}
                    searchable
                    disabled={results !== undefined || !boxes.length}
                />
                <TextInput
                    label={t('home.search')}
                    leftSection={<SearchIcon size={14} />}
                    value={filter}
                    onChange={e => {
                        setPage(1);
                        setFilter(e.currentTarget.value);
                    }}
                />
            </Group>
        </Card.Section>

        <Box className='home-box-scroll'>
            {results?.length === 0
                ? <Text c='dimmed' ta='center' p='md'>{t('home.no-results')}</Text>
                : <UISpriteSizeWrapper component={UIStorageBoxGrid} speciesSize={spriteSize} columns={6}>
                    {slots.map((p, index) => {
                        if (!p) return <Box className='home-slot home-empty-slot' key={index} aria-hidden />;
                        const name = speciesName(p);
                        const nickname = p.nickname.trim() || name;
                        return <UIStorageItemBase
                            key={p.id}
                            className='home-slot'
                            classNames={{ label: 'home-slot-label' }}
                            aria-label={nickname === name ? name : nickname + ' (' + name + ')'}
                            aria-pressed={selected?.id === p.id}
                            selected={selected?.id === p.id}
                            onClick={() => onSelectPokemon(p)}
                        >
                            <span className='home-slot-content'>
                                <SpeciesImg
                                    species={p.species} context={p.spriteContext} form={p.form}
                                    isFemale={p.gender === Gender.Female} isShiny={p.isShiny} isEgg={p.isEgg}
                                />
                                <span className='home-slot-name'>{nickname}</span>
                                {name !== nickname && <span className='home-slot-species'>{name}</span>}
                                {results && <span className='home-slot-species'>{boxNames.get(p.box)}</span>}
                            </span>
                            <UIStorageItemIcons isShiny={p.isShiny} level={p.level} />
                        </UIStorageItemBase>;
                    })}
                </UISpriteSizeWrapper>}
        </Box>

        <Card.Section withBorder inheritPadding py='xs'>
            <Group justify='space-between'>
                {results ? <Text size='sm'>{t('home.pokemon-count', { count: results.length })}</Text>
                    : <Text size='sm'>{box?.pokemon.length ?? 0}/{homeBoxSize}</Text>}
                {!!box && !box.exactSlots && !results && <Tooltip label={t('home.positions-unknown')} multiline w={290}>
                    <Group gap='xs' c='dimmed'>
                        <InfoIcon size={14} />
                        <Text size='xs'>{t('home.compact-order')}</Text>
                    </Group>
                </Tooltip>}
                {pageCount > 1 && <Pagination size='xs' total={pageCount} value={visiblePage} onChange={setPage} />}
            </Group>
        </Card.Section>
    </Card>;
}
