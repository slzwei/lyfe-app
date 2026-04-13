/**
 * Face verification edge function — compares a live selfie against a stored reference photo
 * using AWS Rekognition CompareFaces.
 *
 * POST /verify-face
 *   Body: { action: "check" }
 *     → Returns { registered: boolean, registered_at: string | null }
 *       without downloading the photo or calling Rekognition. Used by UI to
 *       show "Registered" / "Not Registered" state on mount.
 *   Body: { action: "register", photo: "<base64 JPEG>" }
 *     → Stores reference photo in face-references bucket. Rejected with a
 *       reason code if the photo fails the quality gates below.
 *   Body: { action: "verify", photo: "<base64 JPEG>" }
 *     → Compares against stored reference, returns similarity score. Rejected
 *       with a reason code if the live photo fails the quality gates below.
 *
 * Quality gates (applied to BOTH register and verify): DetectFaces checks that
 * exactly one high-confidence, unoccluded, sharp, bright, large-enough face is
 * present. Running the same gate on register ensures the reference photo meets
 * the same bar as the live shots it'll be compared against.
 *
 * Requires authenticated user (JWT). AWS credentials via env vars.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RekognitionClient, CompareFacesCommand, DetectFacesCommand } from 'npm:@aws-sdk/client-rekognition';

const SIMILARITY_THRESHOLD = 99.0;
const BUCKET = 'face-references';

// Quality gate thresholds for the live image (rejects half-faces, blurry shots,
// occluded faces, dark images, etc. before trusting the CompareFaces result).
const MIN_FACE_CONFIDENCE = 99.0;
const MIN_SHARPNESS = 50.0;
const MIN_BRIGHTNESS = 30.0;
const MIN_FACE_AREA = 0.1; // bounding box area as fraction of image
const OCCLUSION_CONFIDENCE_THRESHOLD = 80.0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rekognition = new RekognitionClient({
    region: Deno.env.get('AWS_REGION') || 'ap-southeast-1',
    credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
    },
});

// Shape returned to the client on a quality failure. Identical across
// register and verify, so the app can render one consistent FailedOverlay.
type QualityFailure = {
    reason: 'no_face' | 'multiple_faces' | 'low_face_confidence' | 'occluded' | 'blurry' | 'too_dark' | 'too_small';
    message: string;
};

/**
 * Pure, synchronous quality gate applied to a DetectFaces response.
 * Returns `{ ok: true }` if the face passes every gate; otherwise returns
 * the first failing reason. Called by BOTH the register and verify branches
 * so reference photos meet the same bar as live shots.
 */
// deno-lint-ignore no-explicit-any
function checkFaceQuality(detectResp: any): { ok: true } | ({ ok: false } & QualityFailure) {
    const faces = detectResp.FaceDetails ?? [];

    if (faces.length === 0) {
        return { ok: false, reason: 'no_face', message: 'No face detected. Please face the camera.' };
    }
    if (faces.length > 1) {
        return {
            ok: false,
            reason: 'multiple_faces',
            message: 'Multiple faces detected. Only one person at a time.',
        };
    }

    const face = faces[0];

    if ((face.Confidence ?? 0) < MIN_FACE_CONFIDENCE) {
        return {
            ok: false,
            reason: 'low_face_confidence',
            message: 'Face not clearly visible. Move to better lighting.',
        };
    }

    // FaceOccluded catches the "paper over half the face" case — purpose-built by AWS.
    if (face.FaceOccluded?.Value === true && (face.FaceOccluded.Confidence ?? 0) >= OCCLUSION_CONFIDENCE_THRESHOLD) {
        return {
            ok: false,
            reason: 'occluded',
            message: 'Face is partially covered. Remove anything blocking your face.',
        };
    }

    if ((face.Quality?.Sharpness ?? 0) < MIN_SHARPNESS) {
        return { ok: false, reason: 'blurry', message: 'Image too blurry. Hold the phone steady.' };
    }

    if ((face.Quality?.Brightness ?? 0) < MIN_BRIGHTNESS) {
        return { ok: false, reason: 'too_dark', message: 'Image too dark. Move to better lighting.' };
    }

    const bb = face.BoundingBox;
    const area = (bb?.Width ?? 0) * (bb?.Height ?? 0);
    if (area < MIN_FACE_AREA) {
        return { ok: false, reason: 'too_small', message: 'Move closer to the camera.' };
    }

    return { ok: true };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'Missing authorization' }, 401);
        }

        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { action, photo } = await req.json();
        if (!action) {
            return jsonResponse({ error: 'Missing action' }, 400);
        }

        // Use service role for storage operations
        const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        if (action === 'check') {
            // Lightweight registration probe — reads the users.face_registered_at
            // column instead of hitting storage. The column is the authoritative
            // source of truth for "has this user registered a face"; the bucket
            // file is the actual photo bytes used by verify. They're kept in sync
            // by the register branch below (both are written transactionally from
            // the app's perspective — if the upload fails, the column isn't set).
            const { data, error: selectError } = await adminClient
                .from('users')
                .select('face_registered_at')
                .eq('id', user.id)
                .maybeSingle();

            if (selectError) {
                console.error('Select error:', selectError);
                return jsonResponse({ error: 'Failed to check registration status' }, 500);
            }

            return jsonResponse({
                registered: !!data?.face_registered_at,
                registered_at: data?.face_registered_at ?? null,
            });
        }

        // The remaining actions require a photo payload.
        if (!photo) {
            return jsonResponse({ error: 'Missing photo' }, 400);
        }

        const photoBytes = base64ToBytes(photo);

        if (action === 'register') {
            // Run the same DetectFaces quality gate we use on verify so we never
            // store a reference that can't be matched later (blurry, occluded,
            // dark, too small, off-frame, or wrong number of faces).
            const detectResp = await rekognition.send(
                new DetectFacesCommand({
                    Image: { Bytes: photoBytes },
                    Attributes: ['ALL'],
                }),
            );

            const quality = checkFaceQuality(detectResp);
            if (!quality.ok) {
                return jsonResponse({
                    success: false,
                    reason: quality.reason,
                    message: quality.message,
                });
            }

            const { error: uploadError } = await adminClient.storage.from(BUCKET).upload(`${user.id}.jpg`, photoBytes, {
                contentType: 'image/jpeg',
                upsert: true,
            });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return jsonResponse({ error: 'Failed to store reference photo' }, 500);
            }

            // Stamp the registration on the users row so the check action and
            // any future DB-level queries know this user is registered. If this
            // update fails after a successful upload the bucket file still
            // exists — not ideal, but better than blocking the whole register
            // call; the user can re-register to resync.
            const registeredAt = new Date().toISOString();
            const { error: updateError } = await adminClient
                .from('users')
                .update({ face_registered_at: registeredAt })
                .eq('id', user.id);

            if (updateError) {
                console.error('face_registered_at update error:', updateError);
                // Do not fail the request — the photo is stored and verify will
                // still work. Log loudly so we notice drift.
            }

            return jsonResponse({
                success: true,
                message: 'Reference photo registered',
                registered_at: registeredAt,
            });
        }

        if (action === 'verify') {
            // Download reference photo
            const { data: refData, error: downloadError } = await adminClient.storage
                .from(BUCKET)
                .download(`${user.id}.jpg`);

            if (downloadError || !refData) {
                console.error('Download error:', downloadError);
                return jsonResponse({ error: 'No reference photo found. Please register first.' }, 404);
            }

            const refBytes = new Uint8Array(await refData.arrayBuffer());

            // Debug: check JPEG headers (FF D8 FF)
            const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
            (globalThis as any).__debug = {
                ref: {
                    len: refBytes.length,
                    jpeg: isJpeg(refBytes),
                    h: `${refBytes[0]},${refBytes[1]},${refBytes[2]}`,
                },
                live: {
                    len: photoBytes.length,
                    jpeg: isJpeg(photoBytes),
                    h: `${photoBytes[0]},${photoBytes[1]},${photoBytes[2]}`,
                },
            };

            // Run quality detection + face comparison in parallel to keep latency low.
            // DetectFaces is the gate: it catches occluded, blurry, dark, off-frame, or
            // missing faces before we trust the CompareFaces similarity score.
            const [detectResp, compareResp] = await Promise.all([
                rekognition.send(
                    new DetectFacesCommand({
                        Image: { Bytes: photoBytes },
                        Attributes: ['ALL'],
                    }),
                ),
                rekognition.send(
                    new CompareFacesCommand({
                        SourceImage: { Bytes: refBytes },
                        TargetImage: { Bytes: photoBytes },
                        SimilarityThreshold: 0,
                    }),
                ),
            ]);

            // ── Quality gate on the live image (shared with register) ──
            const quality = checkFaceQuality(detectResp);
            if (!quality.ok) {
                return jsonResponse({
                    match: false,
                    similarity: 0,
                    reason: quality.reason,
                    message: quality.message,
                });
            }

            // ── Quality gate passed → check similarity ──
            let similarity = 0;
            const confidence = compareResp.SourceImageFace?.Confidence ?? 0;

            if (compareResp.FaceMatches && compareResp.FaceMatches.length > 0) {
                similarity = compareResp.FaceMatches[0].Similarity ?? 0;
            }

            const match = similarity >= SIMILARITY_THRESHOLD;
            return jsonResponse({
                match,
                similarity,
                confidence,
                reason: match ? undefined : 'low_similarity',
                message: match ? undefined : 'Face does not match the registered photo.',
            });
        }

        return jsonResponse({ error: 'Invalid action. Use "register" or "verify".' }, 400);
    } catch (err) {
        console.error('verify-face error:', err);
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        // Include debug info temporarily
        return jsonResponse({ error: message, debug: (globalThis as any).__debug }, 500);
    }
});

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
