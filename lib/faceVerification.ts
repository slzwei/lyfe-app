/**
 * Face verification — AWS Rekognition via Supabase edge function.
 *
 * Registration: stores a reference JPEG in Supabase storage.
 * Verification: compares a live JPEG against the stored reference.
 */
import { File } from 'expo-file-system/next';
import { convertToJpeg } from '../modules/face-detection/src';
import { isNetworkError } from './offline/safeQuery';
import { supabase } from './supabase';

export const MATCH_THRESHOLD = 99.0;

// Uploaded images are downsized so a flaky connection isn't asked to push
// multiple megabytes (full-res selfies were ~1.3-4MB base64). convertToJpeg
// downsamples the long edge natively, preserving EXIF orientation. Kept
// generous so Rekognition's sharpness gate (>=50) and the strict 99% match
// threshold against existing references still pass.
const MAX_UPLOAD_EDGE = 1600;
const UPLOAD_QUALITY = 0.85;

// Fail fast on a stalled upload instead of waiting out the ~60s OS default. A
// timeout aborts the invoke's fetch, which supabase-js surfaces as a
// FunctionsFetchError ("Failed to send a request to the Edge Function") — the
// same shape a real transport drop produces, so isConnectivityError catches both.
const INVOKE_TIMEOUT_MS = 30_000;

/**
 * True when a thrown error (or an error-message string) represents a
 * transport/connectivity failure — no HTTP response — rather than a server or
 * face-quality rejection. Covers supabase-js's FunctionsFetchError message and
 * invoke timeouts, both of which reach callers as a plain Error whose message is
 * "Failed to send a request to the Edge Function" (registerFace/verifyFace
 * rethrow `error.message`, dropping the SDK error name — so classify by message).
 */
export function isConnectivityError(input: unknown): boolean {
    if (typeof input === 'string') return isNetworkError(new Error(input));
    return isNetworkError(input);
}

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

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function readPhotoAsBase64(filePath: string): Promise<string> {
    // VisionCamera saves as HEIC on modern iPhones — convert to JPEG and
    // downscale to MAX_UPLOAD_EDGE in a single native pass (orientation-safe).
    const jpegPath = await convertToJpeg(filePath, UPLOAD_QUALITY, MAX_UPLOAD_EDGE);
    // Ensure file:// prefix (Android returns raw paths, File constructor needs URI)
    const uri = jpegPath.startsWith('file://') ? jpegPath : `file://${jpegPath}`;
    const file = new File(uri);
    const bytes = await file.bytes();
    console.log(`[FaceVerify] JPEG: ${bytes.length} bytes, header: ${bytes[0]},${bytes[1]},${bytes[2]}`);
    return bytesToBase64(bytes);
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
        timeout: INVOKE_TIMEOUT_MS,
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
    // E2E bypass — fires only when the build was produced with the env flag
    // explicitly set to '1'. Camera + Rekognition can't be driven by Maestro,
    // so CI builds short-circuit here without reading the (fake) photo path.
    if (process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1') {
        return { match: true, similarity: 100, confidence: 100 };
    }

    const base64 = await readPhotoAsBase64(photoPath);
    console.log('[FaceVerify] Sending verify request, base64 length:', base64.length);

    const { data, error } = await supabase.functions.invoke('verify-face', {
        body: { action: 'verify', photo: base64 },
        timeout: INVOKE_TIMEOUT_MS,
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
