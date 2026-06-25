/**
 * Document classification — pure, dependency-free so the viewer can import it
 * without pulling in the Supabase client.
 */

export type DocumentKind = 'pdf' | 'image' | 'other';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp']);

/**
 * Classify a candidate document by its file name (or storage path) so the viewer
 * can render it correctly. Documents uploaded from the web ATS may be PDF, JPEG,
 * PNG, DOC, or DOCX — only PDFs can go to react-native-pdf; images render as
 * <Image>, and everything else opens externally.
 *
 * Defaults to 'pdf' when no name is given: the generated registration/DISC PDFs
 * are always PDFs and are opened without a file name.
 */
export function getDocumentKind(fileNameOrPath?: string | null): DocumentKind {
    if (!fileNameOrPath) return 'pdf';
    const path = fileNameOrPath.split('?')[0]; // drop any signed-URL query string
    const dot = path.lastIndexOf('.');
    if (dot < 0) return 'other';
    const ext = path.slice(dot + 1).toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    return 'other';
}
