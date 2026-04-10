import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing required Supabase environment variables. ' +
            'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
    );
}

// SecureStore has a 2048-byte limit per item. Large values (e.g. Supabase
// session JWTs) are split into 2000-byte chunks stored in SecureStore.
const CHUNK_SIZE = 2000;

// Use AFTER_FIRST_UNLOCK so Supabase's autoRefreshToken timer can read the
// session from the keychain even when the device is locked. The default
// (WHEN_UNLOCKED) causes "User interaction is not allowed" errors on
// background refresh ticks.
const STORE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** Clean up legacy AsyncStorage fallback keys from the old implementation. */
async function cleanupLegacyKeys(key: string): Promise<void> {
    await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
}

const secureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return null;
            return localStorage.getItem(key);
        }

        // Migrate: check old AsyncStorage fallback and move to chunks
        const legacy = await AsyncStorage.getItem(`supabase_as_${key}`).catch(() => null);
        if (legacy !== null) {
            // Migrate to chunked SecureStore and remove legacy key
            await secureStoreAdapter.setItem(key, legacy);
            await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
            return legacy;
        }

        // Check for chunked storage
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
                const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => null);
                if (chunk === null) return null; // corrupted — treat as missing
                parts.push(chunk);
            }
            return parts.join('');
        }

        // Single value
        return SecureStore.getItemAsync(key, STORE_OPTS).catch(() => null);
    },

    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return;
            localStorage.setItem(key, value);
            return;
        }

        // Clean up legacy AsyncStorage keys
        cleanupLegacyKeys(key);

        if (value.length > CHUNK_SIZE) {
            // Remove any existing single value
            await SecureStore.deleteItemAsync(key, STORE_OPTS).catch(() => {});

            // Remove old chunks if they exist
            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
                }
            }

            // Write new chunks
            const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
            for (let i = 0; i < chunkCount; i++) {
                const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk, STORE_OPTS).catch(() => {});
            }
            await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount), STORE_OPTS).catch(() => {});
        } else {
            // Remove any existing chunks
            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
                }
                await SecureStore.deleteItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => {});
            }

            await SecureStore.setItemAsync(key, value, STORE_OPTS).catch(() => {});
        }
    },

    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(key);
            return;
        }

        // Remove single value
        await SecureStore.deleteItemAsync(key, STORE_OPTS).catch(() => {});

        // Remove chunks if they exist
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            for (let i = 0; i < count; i++) {
                await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
            }
            await SecureStore.deleteItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => {});
        }

        // Clean up legacy keys
        await cleanupLegacyKeys(key);
    },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
