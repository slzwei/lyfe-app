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
 * Convert any image (HEIC, PNG, etc.) to JPEG.
 * @param imagePath - Local file path or file:// URI
 * @param quality - JPEG compression quality 0.0-1.0
 * @param maxDimension - If > 0, downscale so the longest edge is at most this
 *   many pixels (preserves aspect ratio + EXIF orientation). 0 = no resize.
 * @returns Path to the converted JPEG file
 */
export async function convertToJpeg(
    imagePath: string,
    quality: number = 0.8,
    maxDimension: number = 0,
): Promise<string> {
    return NativeModule.convertToJpeg(imagePath, quality, maxDimension);
}

/** Set screen brightness to max (fill light for face capture). */
export function setMaxBrightness(): void {
    NativeModule.setMaxBrightness();
}

/** Restore brightness to the value before setMaxBrightness was called. */
export function restoreBrightness(): void {
    NativeModule.restoreBrightness();
}

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
