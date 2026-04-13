/**
 * Face verification — AWS Rekognition via Supabase edge function.
 *
 * Registration: stores a reference JPEG in Supabase storage.
 * Verification: compares a live JPEG against the stored reference.
 */
import { File } from 'expo-file-system/next';
import { convertToJpeg } from '../modules/face-detection/src';
import { supabase } from './supabase';

export const MATCH_THRESHOLD = 99.0;

export type FaceQualityReason =
    | 'no_face'
    | 'multiple_faces'
    | 'low_face_confidence'
    | 'occluded'
    | 'blurry'
    | 'too_dark'
    | 'too_small';

// Quality reasons can happen on either register or verify; 'low_similarity' is verify-only.
export type FaceVerifyReason = FaceQualityReason | 'low_similarity';

export interface FaceVerifyResult {
    match: boolean;
    similarity: number;
    confidence: number;
    reason?: FaceVerifyReason;
    message?: string;
}

export type FaceRegisterResult = { success: true } | { success: false; reason: FaceQualityReason; message: string };

export interface FaceRegistrationStatus {
    registered: boolean;
    registeredAt: string | null;
}

/**
 * Check whether the currently authenticated user has a face reference stored.
 * Does NOT download the photo or call Rekognition — cheap enough to run on
 * every mount of the face verification UI.
 */
export async function checkFaceRegistration(): Promise<FaceRegistrationStatus> {
    const { data, error } = await supabase.functions.invoke('verify-face', {
        body: { action: 'check' },
    });

    if (error) throw new Error(error.message || 'Failed to check registration status');
    if (data?.error) throw new Error(data.error);

    return {
        registered: !!data?.registered,
        registeredAt: data?.registered_at ?? null,
    };
}

async function readPhotoAsBase64(filePath: string): Promise<string> {
    // VisionCamera saves as HEIC on modern iPhones — convert to JPEG
    const jpegPath = await convertToJpeg(filePath, 0.5);
    // Ensure file:// prefix (Android returns raw paths, File constructor needs URI)
    const uri = jpegPath.startsWith('file://') ? jpegPath : `file://${jpegPath}`;
    const file = new File(uri);
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
 *
 * The edge function runs the same DetectFaces quality gate as verify, so a
 * registration can fail for the same reasons a verify can (occluded, blurry,
 * multiple faces, etc.). This function returns a discriminated union so the
 * caller can show the same rich failure UX on both paths.
 *
 * @param photoPath - Local file path to a JPEG photo
 * @throws Error on infrastructure/network failures. Quality failures are
 *         returned as `{ success: false, reason, message }`, not thrown.
 */
export async function registerFace(photoPath: string): Promise<FaceRegisterResult> {
    const base64 = await readPhotoAsBase64(photoPath);
    console.log('[FaceVerify] Sending register request, base64 length:', base64.length);

    const { data, error } = await supabase.functions.invoke('verify-face', {
        body: { action: 'register', photo: base64 },
    });

    console.log('[FaceVerify] Register response:', JSON.stringify(data), 'error:', JSON.stringify(error));
    if (error) throw new Error(error.message || 'Registration failed');
    if (data?.error) throw new Error(data.error);

    if (data?.success === false) {
        return {
            success: false,
            reason: data.reason as FaceQualityReason,
            message: data.message as string,
        };
    }

    return { success: true };
}

/**
 * Verify a live photo against the stored reference.
 * @param photoPath - Local file path to a JPEG photo
 * @returns match result with similarity percentage and (on failure) a reason code
 */
export async function verifyFace(photoPath: string): Promise<FaceVerifyResult> {
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
        reason: data.reason,
        message: data.message,
    };
}
