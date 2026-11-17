import { Alert, Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { useHomeGetAll } from '../data/sdk/home/home.gen';
import { useTranslate } from '../translate/i18n';

/** HOME is deliberately outside the numbered game generations. */
export function HomeSummary() {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const query = useHomeGetAll();
  if (query.isError) return <Alert color='red'>{t('home.error')}</Alert>;
  if (!query.data?.data.length) return null;
  return <Card.Section inheritPadding withBorder py='md'>
    <Stack gap='sm'>
      <Group><Text fw={700}>Pokémon HOME</Text><Badge color='cyan'>{t('home.read-only')}</Badge></Group>
      <Group align='stretch'>
        {query.data.data.map(collection => {
          const active = collection.snapshots.find(s => s.id === collection.activeSnapshotId);
          return <Card key={collection.id} withBorder miw={240}>
            <Stack gap='xs'>
              <Text fw={700}>{collection.name}</Text>
              {collection.error ? <Text c='red'>{collection.error}</Text> : <>
                <Text>{active?.pokemonCount ?? 0} Pokémon · {active?.boxCount ?? 0} {t('home.boxes')}</Text>
                <Text size='sm' c='dimmed'>{active?.label ?? t('home.empty')} · {collection.snapshots.length} {t('home.snapshots')}</Text>
                <Button onClick={() => navigate({ to: '/home', search: { collection: collection.id } })} variant='light' color='cyan'>{t('home.open')}</Button>
              </>}
            </Stack>
          </Card>;
        })}
      </Group>
    </Stack>
  </Card.Section>;
}
