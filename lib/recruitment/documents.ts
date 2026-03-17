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

export async function uploadCandidateDocument(
    candidateId: string,
    label: string,
    fileUri: string,
    fileName: string,
): Promise<{ data: CandidateDocument | null; error: string | null }> {
    try {
        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();

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
    } catch (err: any) {
        captureError(err, { fn: 'uploadCandidateDocument' });
        return { data: null, error: err?.message || 'Upload failed' };
    }
}

export async function deleteCandidateDocument(documentId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('candidate_documents').delete().eq('id', documentId);

    if (error) return { error: error.message };
    return { error: null };
}
