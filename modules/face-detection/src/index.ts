import { requireNativeModule } from 'expo-modules-core';

export interface DetectedFace {
    hasYaw: boolean;
    /** Yaw angle in degrees. Positive = looking right. */
    yaw: number;
    hasRoll: boolean;
    /** Roll angle in degrees. */
    roll: number;
    hasPitch?: boolean;
    /** Pitch angle in degrees (iOS 15+). */
    pitch?: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
}

const NativeModule = requireNativeModule('FaceDetection');

/**
 * Detect faces in a static image. Runs on a background thread
 * using Apple's Vision framework — does not affect camera preview.
 *
 * @param imagePath - Local file path or file:// URI to the image.
 * @returns Array of detected faces with yaw/roll/pitch angles.
 */
export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
    return NativeModule.detectFaces(imagePath);
}
