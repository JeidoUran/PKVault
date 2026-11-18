import { Card, Group, Text } from '@mantine/core';
import React from 'react';
import type { UIDetailsContentProps } from './ui-details-content';

export const UIDetailsContentExpanded: React.FC<UIDetailsContentProps & { fluid?: boolean }> = ({ content, fluid }) => {

    return content.map(item => <Card key={item.name} shadow='none' w={fluid ? '100%' : 280} maw='100%'>
        <Card.Section withBorder inheritPadding>
            <Text component={Group} justify='center' wrap='nowrap' gap='sm'>
                {item.label}
            </Text>
        </Card.Section>

        <Card.Section withBorder inheritPadding py='inherit'>
            {item.content}
        </Card.Section>
    </Card>);
};
