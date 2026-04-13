/**
 * Face registration screen — user-facing, production path.
 *
 * Wraps FaceCaptureFlow in `register` mode. On a successful photo, runs
 * registerFace(), optimistically updates AuthContext so the Profile
 * FaceIdCard reflects the new state immediately, and navigates back.
 *
 * Quality-gate rejections (blurry, occluded, multi-face, etc.) are handled
 * by FaceCaptureFlow's built-in retry overlay — the parent only sees
 * successful captures or hard errors here.
 */
import { FaceCaptureFlow, type FaceCaptureResult } from '@/components/face/FaceCaptureFlow';
import { useAuth } from '@/contexts/AuthContext';
import { registerFace } from '@/lib/faceVerification';
import { captureError } from '@/lib/sentry';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

export default function FaceRegisterScreen() {
    const router = useRouter();
    const { updateFaceRegisteredAt } = useAuth();

    const handlePhotoCaptured = useCallback(
        async (photoPath: string): Promise<FaceCaptureResult> => {
            try {
                const result = await registerFace(photoPath);

                if (result.success) {
                    // Optimistic update — the FaceIdCard on the Profile index
                    // reads this value via useAuth() so it re-renders the
                    // moment the user dismisses the success overlay.
                    updateFaceRegisteredAt(new Date().toISOString());
                    return { ok: true };
                }

                // Quality gate rejection (blurry, occluded, etc.) — show retry.
                return { ok: false, reason: result.reason, message: result.message };
            } catch (err) {
                captureError(err, { context: 'face-register.handlePhotoCaptured' });
                return {
                    ok: false,
                    reason: 'low_face_confidence',
                    message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
                };
            }
        },
        [updateFaceRegisteredAt],
    );

    const handleDismiss = useCallback(() => {
        router.back();
    }, [router]);

    return <FaceCaptureFlow mode="register" onPhotoCaptured={handlePhotoCaptured} onDismiss={handleDismiss} />;
}
