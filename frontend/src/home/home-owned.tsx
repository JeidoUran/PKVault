import { Button } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { useHomeGetAll, useHomeGetSnapshot } from '../data/sdk/home/home.gen';
import type { HomeCollectionDTO } from '../data/sdk/model';

export function HomeOwned({ species }: { species: number }) {
  const collections = useHomeGetAll().data?.data ?? [];
  return collections.filter(c => c.activeSnapshotId).map(c => <HomeOwnedCollection key={c.id} collection={c} species={species} />);
}
function HomeOwnedCollection({ collection: c, species }: { collection: HomeCollectionDTO; species: number }) {
  const navigate = useNavigate();
  const snapshot = useHomeGetSnapshot({ collectionId: c.id, snapshotId: c.activeSnapshotId });
  const count = snapshot.data?.data.boxes.reduce((sum, b) => sum + b.pokemon.filter(p => p.species === species && !p.isEgg).length, 0) ?? 0;
  if (!count) return null;
  return <Button
    onClick={() => navigate({ to: '/home', search: { collection: c.id, species } })} variant='light' color='cyan'>
    Pokémon HOME · {count}
  </Button>;
}
