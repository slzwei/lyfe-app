/**
 * Face embedding storage — SecureStore-based for the POC.
 *
 * In production this will sync with a Supabase `face_embeddings` table.
 * For now, embeddings are stored locally only.
 */
import * as SecureStore from 'expo-secure-store';
import { base64ToEmbedding, embeddingToBase64 } from './faceVerification';

const KEY_PREFIX = 'lyfe_face_embedding_';

/** Save a face embedding for a user. */
export async function saveEmbedding(userId: string, embedding: Float32Array): Promise<void> {
    const b64 = embeddingToBase64(embedding);
    await SecureStore.setItemAsync(`${KEY_PREFIX}${userId}`, b64);
}

/** Retrieve a stored embedding, or null if none registered. */
export async function getEmbedding(userId: string): Promise<Float32Array | null> {
    const b64 = await SecureStore.getItemAsync(`${KEY_PREFIX}${userId}`);
    if (!b64) return null;
    return base64ToEmbedding(b64);
}

/** Delete a stored embedding. */
export async function deleteEmbedding(userId: string): Promise<void> {
    await SecureStore.deleteItemAsync(`${KEY_PREFIX}${userId}`);
}

/** Check if a user has a registered face embedding. */
export async function hasEmbedding(userId: string): Promise<boolean> {
    const b64 = await SecureStore.getItemAsync(`${KEY_PREFIX}${userId}`);
    return b64 !== null;
}
