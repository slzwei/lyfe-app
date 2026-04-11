/**
 * Face verification — ONNX model inference + embedding comparison.
 *
 * Uses OpenCV SFace (MobileFaceNet backbone, int8 quantized, 9.4 MB).
 * Input: 112x112 RGB image normalised to [-1, 1].
 * Output: 128-d float32 embedding vector.
 */
import { Asset } from 'expo-asset';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { loadImage, type Image, type PixelFormat } from 'react-native-nitro-image';

// ── Constants ───────────────────────────────────────────────

/** Cosine similarity threshold for a positive match. */
export const MATCH_THRESHOLD = 0.4;

/** Input image size expected by the model. */
const INPUT_SIZE = 112;

// ── Session singleton ───────────────────────────────────────

let session: InferenceSession | null = null;
let sessionLoading: Promise<InferenceSession> | null = null;

/** Load the ONNX model (lazy, cached). */
export async function loadModel(): Promise<InferenceSession> {
    if (session) return session;
    if (sessionLoading) return sessionLoading;

    sessionLoading = (async () => {
        // Download the model asset to a local file path.
        // ONNX Runtime needs a file:// URI, not the HTTP URL that
        // Image.resolveAssetSource returns in dev mode.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const asset = Asset.fromModule(require('@/assets/models/sface_int8.onnx'));
        await asset.downloadAsync();

        const modelPath = asset.localUri;
        if (!modelPath) throw new Error('Failed to download ONNX model asset');

        const sess = await InferenceSession.create(modelPath);
        session = sess;
        sessionLoading = null;
        return sess;
    })();

    return sessionLoading;
}

// ── Embedding extraction ────────────────────────────────────

/**
 * Extract a 128-d face embedding from a cropped face image.
 *
 * The image should be a tightly cropped face (bounding box from ML Kit).
 * It will be resized to 112x112 and normalised.
 *
 * @param rgbData - Float32Array of RGB pixel data in CHW format,
 *                  already normalised to [-1, 1], length = 3 * 112 * 112 = 37632.
 * @returns 128-d Float32Array embedding.
 */
export async function extractEmbedding(rgbData: Float32Array): Promise<Float32Array> {
    const sess = await loadModel();

    const inputTensor = new Tensor('float32', rgbData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    // Use the model's actual input name (SFace uses 'data', not 'input')
    const inputName = sess.inputNames?.[0] ?? 'data';
    const results = await sess.run({ [inputName]: inputTensor });

    // The output tensor name may vary — get the first output
    const outputNames = Object.keys(results);
    if (outputNames.length === 0) {
        throw new Error('ONNX model returned no outputs');
    }

    const outputTensor = results[outputNames[0]];
    const embedding = new Float32Array(outputTensor.data as ArrayLike<number>);

    // L2-normalise the embedding
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= norm;
        }
    }

    return embedding;
}

// ── Comparison ──────────────────────────────────────────────

/**
 * Cosine similarity between two L2-normalised embeddings.
 * Returns a value between -1 and 1 (higher = more similar).
 */
export function compareEmbeddings(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        throw new Error(`Embedding length mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    // Already L2-normalised, so dot product = cosine similarity
    return dot;
}

/**
 * Check if two embeddings match above the threshold.
 */
export function isMatch(a: Float32Array, b: Float32Array): boolean {
    return compareEmbeddings(a, b) >= MATCH_THRESHOLD;
}

// ── Image preprocessing ─────────────────────────────────────

/**
 * Convert raw RGBA pixel data (from a canvas or image decoder) to the
 * CHW float32 tensor the model expects.
 *
 * @param rgba - Uint8Array of RGBA pixels, length = width * height * 4
 * @param width - Source image width
 * @param height - Source image height
 * @returns Float32Array in CHW format, normalised to [-1, 1]
 */
export function rgbaToModelInput(rgba: Uint8Array, width: number, height: number): Float32Array {
    // Simple nearest-neighbour resize to 112x112
    const output = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const xRatio = width / INPUT_SIZE;
    const yRatio = height / INPUT_SIZE;

    for (let y = 0; y < INPUT_SIZE; y++) {
        for (let x = 0; x < INPUT_SIZE; x++) {
            const srcX = Math.min(Math.floor(x * xRatio), width - 1);
            const srcY = Math.min(Math.floor(y * yRatio), height - 1);
            const srcIdx = (srcY * width + srcX) * 4;

            const r = rgba[srcIdx] / 255;
            const g = rgba[srcIdx + 1] / 255;
            const b = rgba[srcIdx + 2] / 255;

            // Normalise to [-1, 1]: (pixel / 255 - 0.5) / 0.5 = pixel / 127.5 - 1
            const pixelCount = INPUT_SIZE * INPUT_SIZE;
            output[0 * pixelCount + y * INPUT_SIZE + x] = r * 2 - 1; // R channel
            output[1 * pixelCount + y * INPUT_SIZE + x] = g * 2 - 1; // G channel
            output[2 * pixelCount + y * INPUT_SIZE + x] = b * 2 - 1; // B channel
        }
    }

    return output;
}

// ── Real face embedding from photo ─────────────────────────

/**
 * Extract a face embedding from a photo file + bounding box.
 *
 * Pipeline: load image → crop to face → resize to 112x112 →
 * extract raw pixels → convert to CHW float32 → ONNX inference.
 *
 * @param filePath - Local file path to the photo (from capturePhotoToFile)
 * @param boundingBox - Face bounding box (normalised 0-1 coordinates from Vision)
 * @returns 128-d Float32Array embedding
 */
export async function extractEmbeddingFromPhoto(
    filePath: string,
    boundingBox?: { x: number; y: number; width: number; height: number },
): Promise<Float32Array> {
    // Load the photo
    const image: Image = await loadImage({ filePath });

    // Crop to face if bounding box provided
    let faceImage: Image;
    if (boundingBox) {
        // Vision framework returns normalised coords (0-1), Y is flipped (origin at bottom-left)
        const startX = Math.max(0, Math.floor(boundingBox.x * image.width));
        const startY = Math.max(0, Math.floor((1 - boundingBox.y - boundingBox.height) * image.height));
        const endX = Math.min(image.width, Math.floor((boundingBox.x + boundingBox.width) * image.width));
        const endY = Math.min(image.height, Math.floor((1 - boundingBox.y) * image.height));
        faceImage = image.crop(startX, startY, endX, endY);
    } else {
        faceImage = image;
    }

    // Resize to 112x112
    const resized = faceImage.resize(INPUT_SIZE, INPUT_SIZE);

    // Get raw pixel data
    const rawData = resized.toRawPixelData();
    const pixels = new Uint8Array(rawData.buffer);

    // Convert to CHW float32 normalised to [-1, 1]
    const modelInput = pixelsToModelInput(pixels, rawData.pixelFormat);

    return extractEmbedding(modelInput);
}

/**
 * Convert raw pixel buffer to CHW float32 tensor for the model.
 * Handles RGBA, BGRA, ARGB, and RGB pixel formats.
 */
function pixelsToModelInput(pixels: Uint8Array, format: PixelFormat): Float32Array {
    const output = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const pixelCount = INPUT_SIZE * INPUT_SIZE;

    // Determine channel offsets based on pixel format
    let rOff: number, gOff: number, bOff: number, stride: number;
    switch (format) {
        case 'RGBA':
        case 'RGBX':
            rOff = 0;
            gOff = 1;
            bOff = 2;
            stride = 4;
            break;
        case 'BGRA':
        case 'BGRX':
            rOff = 2;
            gOff = 1;
            bOff = 0;
            stride = 4;
            break;
        case 'ARGB':
        case 'XRGB':
            rOff = 1;
            gOff = 2;
            bOff = 3;
            stride = 4;
            break;
        case 'ABGR':
        case 'XBGR':
            rOff = 3;
            gOff = 2;
            bOff = 1;
            stride = 4;
            break;
        case 'RGB':
            rOff = 0;
            gOff = 1;
            bOff = 2;
            stride = 3;
            break;
        case 'BGR':
            rOff = 2;
            gOff = 1;
            bOff = 0;
            stride = 3;
            break;
        default:
            // Assume RGBA
            rOff = 0;
            gOff = 1;
            bOff = 2;
            stride = 4;
            break;
    }

    for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * stride;
        // Normalise to [-1, 1]
        output[0 * pixelCount + i] = pixels[srcIdx + rOff] / 127.5 - 1; // R
        output[1 * pixelCount + i] = pixels[srcIdx + gOff] / 127.5 - 1; // G
        output[2 * pixelCount + i] = pixels[srcIdx + bOff] / 127.5 - 1; // B
    }

    return output;
}

// ── Serialisation ───────────────────────────────────────────

/** Encode embedding to base64 for storage. */
export function embeddingToBase64(embedding: Float32Array): string {
    const bytes = new Uint8Array(embedding.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Decode embedding from base64. */
export function base64ToEmbedding(b64: string): Float32Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
}
