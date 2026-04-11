/**
 * Face verification edge function — compares a live selfie against a stored reference photo
 * using AWS Rekognition CompareFaces.
 *
 * POST /verify-face
 *   Body: { action: "register", photo: "<base64 JPEG>" }
 *     → Stores reference photo in face-references bucket
 *   Body: { action: "verify", photo: "<base64 JPEG>" }
 *     → Compares against stored reference, returns similarity score
 *
 * Requires authenticated user (JWT). AWS credentials via env vars.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RekognitionClient, CompareFacesCommand } from 'npm:@aws-sdk/client-rekognition';

const SIMILARITY_THRESHOLD = 90.0;
const BUCKET = 'face-references';

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
        if (!action || !photo) {
            return jsonResponse({ error: 'Missing action or photo' }, 400);
        }

        const photoBytes = base64ToBytes(photo);

        // Use service role for storage operations
        const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        if (action === 'register') {
            const { error: uploadError } = await adminClient.storage.from(BUCKET).upload(`${user.id}.jpg`, photoBytes, {
                contentType: 'image/jpeg',
                upsert: true,
            });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return jsonResponse({ error: 'Failed to store reference photo' }, 500);
            }

            return jsonResponse({ success: true, message: 'Reference photo registered' });
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

            // Call AWS Rekognition
            const resp = await rekognition.send(
                new CompareFacesCommand({
                    SourceImage: { Bytes: refBytes },
                    TargetImage: { Bytes: photoBytes },
                    SimilarityThreshold: 0,
                }),
            );

            let similarity = 0;
            const confidence = resp.SourceImageFace?.Confidence ?? 0;

            if (resp.FaceMatches && resp.FaceMatches.length > 0) {
                similarity = resp.FaceMatches[0].Similarity ?? 0;
            }

            return jsonResponse({
                match: similarity >= SIMILARITY_THRESHOLD,
                similarity,
                confidence,
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
