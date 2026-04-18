/**
 * Candidate document management — fetch, upload, delete
 */
import type { CandidateDocument } from '@/types/recruitment';
import { captureError } from '../sentry';
import { supabase } from '../supabase';

export async function fetchCandidateDocuments(
    candidateId: string,
): Promise<{ data: CandidateDocument[]; error: string | null }> {
    const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidateDocument[], error: null };
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf'];

export async function uploadCandidateDocument(
    candidateId: string,
    label: string,
    fileUri: string,
    fileName: string,
): Promise<{ data: CandidateDocument | null; error: string | null }> {
    try {
        const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return { data: null, error: 'Only PDF files are allowed.' };
        }

        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();

        if (arrayBuffer.byteLength > MAX_DOCUMENT_BYTES) {
            return { data: null, error: 'File must be under 10 MB.' };
        }

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${candidateId}/docs/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('candidate-resumes')
            .upload(filePath, arrayBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) return { data: null, error: uploadError.message };

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('candidate-resumes')
            .createSignedUrl(filePath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
            return { data: null, error: signedUrlError?.message ?? 'Failed to generate signed URL' };
        }

        // Store the file path (not the signed URL) so we can re-sign on each access
        const { data: row, error: insertError } = await supabase
            .from('candidate_documents')
            .insert({ candidate_id: candidateId, label, file_url: filePath, file_name: fileName })
            .select()
            .single();

        if (insertError || !row) return { data: null, error: insertError?.message ?? 'Failed to save document' };

        return { data: row as CandidateDocument, error: null };
    } catch (err: unknown) {
        captureError(err, { fn: 'uploadCandidateDocument' });
        return { data: null, error: err instanceof Error ? err.message : 'Upload failed' };
    }
}

/**
 * Get a signed URL for a PDF in the candidate-pdfs bucket (registration/DISC PDFs).
 */
export async function getGeneratedPdfUrl(filePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from('candidate-pdfs').createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
}

/**
 * Resolve a candidate_documents.file_url to a signed URL.
 * Historical records may hold an already-signed URL; new records hold a storage path.
 * Path routing: candidates/... → candidate-documents bucket (lyfe-sg ATS),
 * anything else → candidate-resumes (mobile uploads + invitation attachments).
 * Falls back across buckets if the first createSignedUrl fails.
 */
export async function getCandidateDocumentUrl(fileUrlOrPath: string): Promise<string | null> {
    if (/^https?:\/\//i.test(fileUrlOrPath)) return fileUrlOrPath;

    const primary = fileUrlOrPath.startsWith('candidates/') ? 'candidate-documents' : 'candidate-resumes';
    const fallback = primary === 'candidate-documents' ? 'candidate-resumes' : 'candidate-documents';

    const signed = await supabase.storage.from(primary).createSignedUrl(fileUrlOrPath, 3600);
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;

    const retry = await supabase.storage.from(fallback).createSignedUrl(fileUrlOrPath, 3600);
    if (!retry.error && retry.data?.signedUrl) return retry.data.signedUrl;

    if (__DEV__) {
        console.warn('[getCandidateDocumentUrl] both buckets failed', {
            fileUrlOrPath,
            primaryBucket: primary,
            primaryError: signed.error?.message,
            fallbackBucket: fallback,
            fallbackError: retry.error?.message,
        });
    }
    captureError(signed.error ?? retry.error ?? new Error('Failed to sign candidate document URL'), {
        fn: 'getCandidateDocumentUrl',
        fileUrlOrPath,
        primary,
        fallback,
    });
    return null;
}

export async function deleteCandidateDocument(documentId: string): Promise<{ error: string | null }> {
    // Fetch the record first so we can delete the storage file
    const { data: doc, error: fetchError } = await supabase
        .from('candidate_documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

    if (fetchError) return { error: fetchError.message };

    // Delete storage file (best-effort — don't block DB delete on storage failure)
    if (doc?.file_url) {
        const { error: storageError } = await supabase.storage.from('candidate-resumes').remove([doc.file_url]);
        if (storageError) {
            captureError(storageError, { fn: 'deleteCandidateDocument', documentId });
        }
    }

    const { error } = await supabase.from('candidate_documents').delete().eq('id', documentId);

    if (error) return { error: error.message };
    return { error: null };
}
