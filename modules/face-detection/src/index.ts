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

export interface FaceChipResult {
    /** BGR CHW Float32 pixel data, length = 3 * 112 * 112 = 37632 */
    pixels: number[];
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    yaw: number;
}

/**
 * Extract a 112x112 face chip from a photo, ready for ONNX inference.
 * Handles EXIF rotation, face crop, resize, and BGR conversion natively.
 * Returns ~37KB of pixel data instead of loading the full 36MB image in JS.
 *
 * @param imagePath - Local file path or file:// URI to the image.
 * @returns Face chip pixel data in BGR CHW format (0-255), or null if no face found.
 */
export async function extractFaceChip(imagePath: string): Promise<FaceChipResult | null> {
    return NativeModule.extractFaceChip(imagePath);
}
