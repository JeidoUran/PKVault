import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { DataDTOType } from '../sdk/model';
import {
    getStorageGetActionsQueryKey,
    getStorageGetBoxesQueryKey,
    getStorageGetInventoryItemsQueryKey,
    getStorageGetSavePkmsQueryKey,
} from '../sdk/storage/storage.gen';
import { updateCacheMutationResponse } from './update-cache-mutation-response';

const backgroundUndo = {
    status: 200,
    headers: new Headers(),
    data: { type: DataDTOType.DATA_DTO, invalidateAllSaves: true, actions: [] },
};

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: false, retry: false } },
    });
}

describe('storage session reset', () => {
    it('reloads restored Pokémon when Storage is opened again after undo elsewhere', async () => {
        const client = createClient();
        const queryKey = getStorageGetSavePkmsQueryKey(42);
        client.setQueryData(queryKey, ['temporary-move']);
        const queryFn = vi.fn(async () => ['restored-pokemon']);

        await updateCacheMutationResponse(client, backgroundUndo);
        expect(queryFn).not.toHaveBeenCalled();
        expect(client.getQueryData(getStorageGetActionsQueryKey())).toMatchObject({ data: [] });

        const observer = new QueryObserver(client, { queryKey, queryFn });
        const unsubscribe = observer.subscribe(() => {});
        try {
            await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(['restored-pokemon']));
        } finally {
            unsubscribe();
            client.clear();
        }
    });

    it('reloads observed save boxes and inventory without resetting main bank data', async () => {
        const client = createClient();
        const boxes = getStorageGetBoxesQueryKey({ saveId: 42 });
        const inventory = getStorageGetInventoryItemsQueryKey({ saveId: 42 });
        const mainBoxes = getStorageGetBoxesQueryKey({ saveId: null });
        client.setQueryData(boxes, ['temporary-box']);
        client.setQueryData(inventory, ['temporary-item']);
        client.setQueryData(mainBoxes, ['main-bank']);
        const observer = new QueryObserver(client, { queryKey: boxes, queryFn: async () => ['restored-box'] });
        const unsubscribe = observer.subscribe(() => {});
        try {
            await updateCacheMutationResponse(client, backgroundUndo);
            expect(client.getQueryData(boxes)).toEqual(['restored-box']);
            expect(client.getQueryData(inventory)).toBeUndefined();
            expect(client.getQueryData(mainBoxes)).toEqual(['main-bank']);
        } finally {
            unsubscribe();
            client.clear();
        }
    });
});
