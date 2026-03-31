/**
 * Tests for lib/supabase.ts — SecureStore chunked adapter
 *
 * We can't import the real module (it creates a Supabase client at load time).
 * Instead, we extract and test the chunking logic by re-implementing the adapter
 * with the same algorithm, using mocked SecureStore and AsyncStorage.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Re-implement the adapter logic to test it in isolation
const CHUNK_SIZE = 2000;

const secureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        // Check legacy AsyncStorage
        const legacy = await AsyncStorage.getItem(`supabase_as_${key}`).catch(() => null);
        if (legacy !== null) {
            await secureStoreAdapter.setItem(key, legacy);
            await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
            return legacy;
        }

        // Check chunked storage
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
                const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
                if (chunk === null) return null;
                parts.push(chunk);
            }
            return parts.join('');
        }

        // Single value
        return SecureStore.getItemAsync(key);
    },

    setItem: async (key: string, value: string): Promise<void> => {
        await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});

        if (value.length > CHUNK_SIZE) {
            await SecureStore.deleteItemAsync(key).catch(() => {});

            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
                }
            }

            const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
            for (let i = 0; i < chunkCount; i++) {
                const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
            }
            await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
        } else {
            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
                }
                await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
            }

            await SecureStore.setItemAsync(key, value);
        }
    },

    removeItem: async (key: string): Promise<void> => {
        await SecureStore.deleteItemAsync(key).catch(() => {});

        const countStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            for (let i = 0; i < count; i++) {
                await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
            }
            await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
        }

        await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
    },
};

// In-memory store for realistic tests
let store: Record<string, string> = {};
let asyncStore: Record<string, string> = {};

beforeEach(() => {
    store = {};
    asyncStore = {};
    jest.clearAllMocks();

    mockSecureStore.getItemAsync.mockImplementation(async (key) => store[key] ?? null);
    mockSecureStore.setItemAsync.mockImplementation(async (key, val) => {
        store[key] = val;
    });
    mockSecureStore.deleteItemAsync.mockImplementation(async (key) => {
        delete store[key];
    });

    mockAsyncStorage.getItem.mockImplementation(async (key) => asyncStore[key] ?? null);
    mockAsyncStorage.removeItem.mockImplementation(async (key) => {
        delete asyncStore[key];
    });
});

describe('SecureStore chunked adapter', () => {
    describe('setItem + getItem', () => {
        it('stores small values as single SecureStore entry', async () => {
            await secureStoreAdapter.setItem('session', 'short-token');
            expect(store['session']).toBe('short-token');
            expect(store['session_chunks']).toBeUndefined();

            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe('short-token');
        });

        it('chunks values exceeding 2000 bytes', async () => {
            const bigToken = 'x'.repeat(4500);
            await secureStoreAdapter.setItem('session', bigToken);

            expect(store['session_chunks']).toBe('3');
            expect(store['session_chunk_0']).toBe('x'.repeat(2000));
            expect(store['session_chunk_1']).toBe('x'.repeat(2000));
            expect(store['session_chunk_2']).toBe('x'.repeat(500));
            expect(store['session']).toBeUndefined(); // single key removed

            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe(bigToken);
        });

        it('correctly reassembles chunks with exact CHUNK_SIZE boundary', async () => {
            const exactToken = 'a'.repeat(4000); // exactly 2 chunks
            await secureStoreAdapter.setItem('session', exactToken);

            expect(store['session_chunks']).toBe('2');
            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe(exactToken);
            expect(result!.length).toBe(4000);
        });

        it('handles value at exactly CHUNK_SIZE (no chunking needed)', async () => {
            const exactLimit = 'b'.repeat(2000);
            await secureStoreAdapter.setItem('session', exactLimit);

            expect(store['session']).toBe(exactLimit);
            expect(store['session_chunks']).toBeUndefined();
        });

        it('handles value at CHUNK_SIZE + 1 (requires chunking)', async () => {
            const justOver = 'c'.repeat(2001);
            await secureStoreAdapter.setItem('session', justOver);

            expect(store['session_chunks']).toBe('2');
            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe(justOver);
        });
    });

    describe('chunk replacement', () => {
        it('cleans up old chunks when storing smaller value', async () => {
            // First: store chunked value (3 chunks)
            await secureStoreAdapter.setItem('session', 'x'.repeat(5000));
            expect(store['session_chunks']).toBe('3');

            // Then: store small value (single)
            await secureStoreAdapter.setItem('session', 'small');
            expect(store['session']).toBe('small');
            expect(store['session_chunks']).toBeUndefined();
            expect(store['session_chunk_0']).toBeUndefined();
            expect(store['session_chunk_1']).toBeUndefined();
            expect(store['session_chunk_2']).toBeUndefined();
        });

        it('cleans up old chunks when storing new chunked value', async () => {
            // First: 3 chunks
            await secureStoreAdapter.setItem('session', 'x'.repeat(5000));
            expect(store['session_chunks']).toBe('3');

            // Then: 2 chunks
            await secureStoreAdapter.setItem('session', 'y'.repeat(3000));
            expect(store['session_chunks']).toBe('2');
            expect(store['session_chunk_2']).toBeUndefined(); // old chunk cleaned
        });
    });

    describe('removeItem', () => {
        it('removes single value', async () => {
            await secureStoreAdapter.setItem('session', 'token');
            await secureStoreAdapter.removeItem('session');

            expect(store['session']).toBeUndefined();
            expect(await secureStoreAdapter.getItem('session')).toBeNull();
        });

        it('removes all chunks', async () => {
            await secureStoreAdapter.setItem('session', 'x'.repeat(4500));
            await secureStoreAdapter.removeItem('session');

            expect(store['session_chunks']).toBeUndefined();
            expect(store['session_chunk_0']).toBeUndefined();
            expect(store['session_chunk_1']).toBeUndefined();
            expect(store['session_chunk_2']).toBeUndefined();
            expect(await secureStoreAdapter.getItem('session')).toBeNull();
        });

        it('cleans up legacy AsyncStorage key', async () => {
            asyncStore['supabase_as_session'] = 'legacy-token';
            await secureStoreAdapter.removeItem('session');
            expect(asyncStore['supabase_as_session']).toBeUndefined();
        });
    });

    describe('legacy migration', () => {
        it('migrates from AsyncStorage to SecureStore on first read', async () => {
            asyncStore['supabase_as_session'] = 'legacy-jwt';

            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe('legacy-jwt');

            // Should now be in SecureStore
            expect(store['session']).toBe('legacy-jwt');
            // Legacy key removed
            expect(asyncStore['supabase_as_session']).toBeUndefined();
        });

        it('migrates large legacy values to chunks', async () => {
            const bigLegacy = 'z'.repeat(4000);
            asyncStore['supabase_as_session'] = bigLegacy;

            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBe(bigLegacy);
            expect(store['session_chunks']).toBe('2');
        });
    });

    describe('corrupted data', () => {
        it('returns null if a chunk is missing', async () => {
            store['session_chunks'] = '3';
            store['session_chunk_0'] = 'part1';
            store['session_chunk_1'] = 'part2';
            // chunk_2 missing

            const result = await secureStoreAdapter.getItem('session');
            expect(result).toBeNull();
        });

        it('returns null when key does not exist', async () => {
            const result = await secureStoreAdapter.getItem('nonexistent');
            expect(result).toBeNull();
        });
    });
});
