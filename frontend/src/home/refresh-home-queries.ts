import type { QueryClient } from '@tanstack/react-query';
import { getDexGetAllQueryKey } from '../data/sdk/dex/dex.gen';
import { getHomeGetAllQueryKey } from '../data/sdk/home/home.gen';

export function refreshHomeQueries(client: QueryClient) {
    const [collections] = getHomeGetAllQueryKey();
    const [dex] = getDexGetAllQueryKey();
    return client.resetQueries({
        predicate: ({ queryKey: [ route ] }) => typeof route === 'string'
            && (route === collections || route === dex || route.startsWith(collections + '/')),
    });
}
