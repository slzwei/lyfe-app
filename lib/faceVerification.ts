/**
 * Face verification — AWS Rekognition via Supabase edge function.
 *
 * Registration: stores a reference JPEG in Supabase storage.
 * Verification: compares a live JPEG against the stored reference.
 */
import { File } from 'expo-file-system/next';
import { convertToJpeg } from '../modules/face-detection/src';
import { supabase } from './supabase';

export const MATCH_THRESHOLD = 90.0;

async function readPhotoAsBase64(filePath: string): Promise<string> {
    // VisionCamera saves as HEIC on modern iPhones — convert to JPEG
    const jpegPath = await convertToJpeg(filePath, 0.8);
    const file = new File(jpegPath);
    const bytes = await file.bytes();
    console.log(`[FaceVerify] JPEG: ${bytes.length} bytes, header: ${bytes[0]},${bytes[1]},${bytes[2]}`);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Register a face photo as the user's reference.
 * @param photoPath - Local file path to a JPEG photo
 */
export async function registerFace(photoPath: string): Promise<void> {
    const base64 = await readPhotoAsBase64(photoPath);
    console.log('[FaceVerify] Sending register request, base64 length:', base64.length);

    const { data, error } = await supabase.functions.invoke('verify-face', {
        body: { action: 'register', photo: base64 },
    });

    console.log('[FaceVerify] Register response:', JSON.stringify(data), 'error:', JSON.stringify(error));
    if (error) throw new Error(error.message || 'Registration failed');
    if (data?.error) throw new Error(data.error);
}

/**
 * Verify a live photo against the stored reference.
 * @param photoPath - Local file path to a JPEG photo
 * @returns match result with similarity percentage
 */
export async function verifyFace(
    photoPath: string,
): Promise<{ match: boolean; similarity: number; confidence: number }> {
    const base64 = await readPhotoAsBase64(photoPath);
    console.log('[FaceVerify] Sending verify request, base64 length:', base64.length);

    const { data, error } = await supabase.functions.invoke('verify-face', {
        body: { action: 'verify', photo: base64 },
    });

    // Try to read the actual error body
    if (error) {
        let detail = error.message;
        try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === 'function') {
                const body = await ctx.json();
                detail = body?.error || detail;
            } else if (ctx && ctx._bodyBlob) {
                const text = await ctx.text();
                detail = text || detail;
            }
        } catch {
            /* ignore */
        }
        console.log('[FaceVerify] Verify error detail:', detail);
        throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);

    return {
        match: data.match,
        similarity: data.similarity,
        confidence: data.confidence,
    };
}
