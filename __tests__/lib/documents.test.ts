/**
 * Tests for lib/recruitment/documents.ts — Candidate document fetch, upload, and delete
 */
import { supabase } from '@/lib/supabase';
import {
    fetchCandidateDocuments,
    uploadCandidateDocument,
    deleteCandidateDocument,
    getCandidateDocumentUrl,
} from '@/lib/recruitment/documents';
import { getDocumentKind } from '@/lib/recruitment/documentKind';
import type { CandidateDocument } from '@/types/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/lib/sentry', () => ({ captureError: jest.fn() }));

const mockSupa = supabase as any;

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ── Fixtures ──

const DOCUMENT_ROW: CandidateDocument = {
    id: 'doc-1',
    candidate_id: 'cand-1',
    label: 'Resume',
    file_url: 'https://example.com/cand-1/docs/1700000000000_resume.pdf',
    file_name: 'resume.pdf',
    created_at: '2026-03-01T10:00:00Z',
};

const DOCUMENT_ROW_2: CandidateDocument = {
    id: 'doc-2',
    candidate_id: 'cand-1',
    label: 'M9',
    file_url: 'https://example.com/cand-1/docs/1700000001000_cert.pdf',
    file_name: 'cert.pdf',
    created_at: '2026-03-02T10:00:00Z',
};

// ── Helpers ──

function mockStorageSuccess(signedUrl = 'https://example.com/cand-1/docs/file.pdf?token=abc') {
    mockSupa.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl }, error: null }),
    });
}

function mockFetchFile(arrayBuffer = new ArrayBuffer(512)) {
    mockFetch.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    });
}

// ── Setup ──

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
    mockFetch.mockReset();
});

// ── fetchCandidateDocuments ──

describe('fetchCandidateDocuments', () => {
    it('returns documents in descending order on success', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: [DOCUMENT_ROW_2, DOCUMENT_ROW], error: null });

        const result = await fetchCandidateDocuments('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('doc-2');
        expect(result.data[1].id).toBe('doc-1');
    });

    it('returns empty array and error message when the query fails', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: null, error: { message: 'Permission denied' } });

        const result = await fetchCandidateDocuments('cand-1');

        expect(result.data).toEqual([]);
        expect(result.error).toBe('Permission denied');
    });

    it('returns empty array with null error when data is null and no error', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: null, error: null });

        const result = await fetchCandidateDocuments('cand-1');

        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
    });
});

// ── uploadCandidateDocument ──

describe('uploadCandidateDocument', () => {
    it('fetches file, uploads to storage, inserts row, and returns the saved document', async () => {
        mockFetchFile();
        mockStorageSuccess('https://example.com/cand-1/docs/resume.pdf');

        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: DOCUMENT_ROW, error: null });

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///resume.pdf', 'resume.pdf');

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.id).toBe('doc-1');
        expect(result.data!.label).toBe('Resume');
        expect(result.data!.candidate_id).toBe('cand-1');
        expect(mockFetch).toHaveBeenCalledWith('file:///resume.pdf');
        expect(mockSupa.storage.from).toHaveBeenCalledWith('candidate-resumes');
    });

    it('returns error and null data when storage upload fails', async () => {
        mockFetchFile();
        mockSupa.storage.from.mockReturnValue({
            upload: jest.fn().mockResolvedValue({ error: { message: 'Bucket quota exceeded' } }),
            createSignedUrl: jest.fn(),
        });

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///resume.pdf', 'resume.pdf');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Bucket quota exceeded');
    });

    it('returns error and null data when DB insert fails', async () => {
        mockFetchFile();
        mockStorageSuccess();

        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: null, error: { message: 'RLS policy violation' } });

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///resume.pdf', 'resume.pdf');

        expect(result.data).toBeNull();
        expect(result.error).toBe('RLS policy violation');
    });

    it('returns fallback error message when insert returns null data with no error', async () => {
        mockFetchFile();
        mockStorageSuccess();

        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: null, error: null });

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///resume.pdf', 'resume.pdf');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Failed to save document');
    });

    it('sanitizes the filename by replacing special characters with underscores', async () => {
        mockFetchFile();

        const storageMock = {
            upload: jest.fn().mockResolvedValue({ error: null }),
            createSignedUrl: jest.fn().mockResolvedValue({
                data: { signedUrl: 'https://example.com/cand-1/docs/safe_file.pdf?token=abc' },
                error: null,
            }),
        };
        mockSupa.storage.from.mockReturnValue(storageMock);

        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: DOCUMENT_ROW, error: null });

        await uploadCandidateDocument('cand-1', 'Resume', 'file:///path.pdf', 'my résumé (2026)!.pdf');

        // The filePath passed to upload must contain only safe characters after the timestamp prefix
        const uploadCall = storageMock.upload.mock.calls[0];
        const uploadedPath: string = uploadCall[0];
        // Strip the timestamp prefix (digits + underscore) before the sanitized name
        const sanitizedPart = uploadedPath.replace(/^cand-1\/docs\/\d+_/, '');
        expect(sanitizedPart).toMatch(/^[a-zA-Z0-9._-]+$/);
        expect(sanitizedPart).not.toContain(' ');
        expect(sanitizedPart).not.toContain('(');
        expect(sanitizedPart).not.toContain('!');
    });

    it('returns error on fetch/network failure', async () => {
        mockFetch.mockRejectedValue(new Error('Network unreachable'));

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///resume.pdf', 'resume.pdf');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Network unreachable');
    });

    it('rejects non-PDF file extensions', async () => {
        const result = await uploadCandidateDocument('cand-1', 'Photo', 'file:///photo.jpg', 'photo.jpg');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Only PDF files are allowed.');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects files without an extension', async () => {
        const result = await uploadCandidateDocument('cand-1', 'Unknown', 'file:///noext', 'noext');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Only PDF files are allowed.');
    });

    it('rejects files over 10 MB', async () => {
        mockFetchFile(new ArrayBuffer(11 * 1024 * 1024));

        const result = await uploadCandidateDocument('cand-1', 'Resume', 'file:///big.pdf', 'big.pdf');

        expect(result.data).toBeNull();
        expect(result.error).toBe('File must be under 10 MB.');
        expect(mockSupa.storage.from).not.toHaveBeenCalled();
    });
});

// ── deleteCandidateDocument ──

describe('deleteCandidateDocument', () => {
    it('fetches the record, deletes storage file, then deletes DB row', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: { file_url: 'cand-1/docs/123_resume.pdf' }, error: null });

        const removeMock = jest.fn().mockResolvedValue({ error: null });
        mockSupa.storage.from.mockReturnValue({ remove: removeMock });

        const result = await deleteCandidateDocument('doc-1');

        expect(result.error).toBeNull();
        expect(mockSupa.storage.from).toHaveBeenCalledWith('candidate-resumes');
        expect(removeMock).toHaveBeenCalledWith(['cand-1/docs/123_resume.pdf']);
    });

    it('returns error when fetch fails (before any deletion)', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: null, error: { message: 'Record not found' } });

        const result = await deleteCandidateDocument('doc-999');

        expect(result.error).toBe('Record not found');
        // Storage should not be touched
        expect(mockSupa.storage.from).not.toHaveBeenCalledWith('candidate-resumes');
    });

    it('still deletes DB row when storage removal fails', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: { file_url: 'cand-1/docs/123_resume.pdf' }, error: null });

        const removeMock = jest.fn().mockResolvedValue({ error: { message: 'Storage error' } });
        mockSupa.storage.from.mockReturnValue({ remove: removeMock });

        const result = await deleteCandidateDocument('doc-1');

        // DB delete still succeeds (chain resolves with error: null)
        expect(result.error).toBeNull();
    });

    it('skips storage delete when file_url is null', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        chain.__resolveWith({ data: { file_url: null }, error: null });

        const result = await deleteCandidateDocument('doc-1');

        expect(result.error).toBeNull();
        expect(mockSupa.storage.from).not.toHaveBeenCalledWith('candidate-resumes');
    });
});

// ── getCandidateDocumentUrl ──

describe('getCandidateDocumentUrl', () => {
    function mockBuckets(opts: {
        primary?: { url?: string; error?: { message: string } };
        fallback?: { url?: string; error?: { message: string } };
    }) {
        const { primary = {}, fallback = {} } = opts;
        const primaryResponse = primary.url
            ? { data: { signedUrl: primary.url }, error: null }
            : { data: null, error: primary.error ?? { message: 'primary failed' } };
        const fallbackResponse = fallback.url
            ? { data: { signedUrl: fallback.url }, error: null }
            : { data: null, error: fallback.error ?? { message: 'fallback failed' } };

        let callIndex = 0;
        mockSupa.storage.from.mockImplementation(() => ({
            createSignedUrl: jest.fn().mockResolvedValue(callIndex++ === 0 ? primaryResponse : fallbackResponse),
        }));
    }

    it('returns http URLs unchanged without calling storage', async () => {
        const result = await getCandidateDocumentUrl('https://example.com/signed.pdf?token=xyz');
        expect(result).toBe('https://example.com/signed.pdf?token=xyz');
        expect(mockSupa.storage.from).not.toHaveBeenCalled();
    });

    it('returns https URLs unchanged (case-insensitive scheme)', async () => {
        const result = await getCandidateDocumentUrl('HTTPS://example.com/file.pdf');
        expect(result).toBe('HTTPS://example.com/file.pdf');
    });

    it('routes candidates/ prefix to candidate-documents bucket first', async () => {
        mockBuckets({ primary: { url: 'https://signed.example.com/ats.pdf?t=1' } });

        const result = await getCandidateDocumentUrl('candidates/cand-1/2026/resume.pdf');

        expect(result).toBe('https://signed.example.com/ats.pdf?t=1');
        expect(mockSupa.storage.from).toHaveBeenNthCalledWith(1, 'candidate-documents');
    });

    it('routes non-prefixed paths to candidate-resumes bucket first', async () => {
        mockBuckets({ primary: { url: 'https://signed.example.com/mobile.pdf?t=2' } });

        const result = await getCandidateDocumentUrl('cand-1/docs/123_resume.pdf');

        expect(result).toBe('https://signed.example.com/mobile.pdf?t=2');
        expect(mockSupa.storage.from).toHaveBeenNthCalledWith(1, 'candidate-resumes');
    });

    it('falls back to the other bucket when primary fails', async () => {
        mockBuckets({
            primary: { error: { message: 'Object not found' } },
            fallback: { url: 'https://signed.example.com/recovered.pdf' },
        });

        const result = await getCandidateDocumentUrl('candidates/cand-1/cross-bucket.pdf');

        expect(result).toBe('https://signed.example.com/recovered.pdf');
        expect(mockSupa.storage.from).toHaveBeenNthCalledWith(1, 'candidate-documents');
        expect(mockSupa.storage.from).toHaveBeenNthCalledWith(2, 'candidate-resumes');
    });

    it('returns null when both buckets fail', async () => {
        mockBuckets({
            primary: { error: { message: 'primary 404' } },
            fallback: { error: { message: 'fallback 404' } },
        });

        const result = await getCandidateDocumentUrl('cand-1/docs/missing.pdf');

        expect(result).toBeNull();
    });
});

// ── getDocumentKind ──

describe('getDocumentKind', () => {
    it('classifies PDF files (case-insensitive)', () => {
        expect(getDocumentKind('resume.pdf')).toBe('pdf');
        expect(getDocumentKind('REPORT.PDF')).toBe('pdf');
        expect(getDocumentKind('candidates/c1/123_form.pdf')).toBe('pdf');
    });

    it('classifies image files (the web ATS allows JPEG/PNG)', () => {
        ['photo.jpg', 'pic.jpeg', 'scan.PNG', 'img.webp', 'live.heic', 'old.bmp', 'frame.gif'].forEach((f) =>
            expect(getDocumentKind(f)).toBe('image'),
        );
    });

    it('classifies Word and other office files as other', () => {
        ['cv.docx', 'old.doc', 'sheet.xlsx', 'notes.txt', 'deck.pptx'].forEach((f) =>
            expect(getDocumentKind(f)).toBe('other'),
        );
    });

    it('ignores signed-URL query strings when reading the extension', () => {
        expect(getDocumentKind('candidates/c1/123_WhatsApp_Image.jpeg?token=abc')).toBe('image');
        expect(getDocumentKind('https://x/y/file.pdf?token=z&expires=1')).toBe('pdf');
    });

    it('defaults to pdf when no name is given (generated registration/DISC PDFs)', () => {
        expect(getDocumentKind()).toBe('pdf');
        expect(getDocumentKind(null)).toBe('pdf');
        expect(getDocumentKind('')).toBe('pdf');
    });

    it('treats names without an extension as other (safer than failing in the PDF viewer)', () => {
        expect(getDocumentKind('noextfile')).toBe('other');
    });
});
