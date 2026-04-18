/**
 * Hook encapsulating document management for a candidate.
 * Manages document list, PDF viewer, add-doc sheet, and upload flow.
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import {
    deleteCandidateDocument,
    fetchCandidateDocuments,
    getCandidateDocumentUrl,
    uploadCandidateDocument,
} from '@/lib/recruitment';
import type { CandidateDocument } from '@/types/recruitment';

let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
    DocumentPicker = require('expo-document-picker');
} catch {
    // Native module not yet compiled into this build — upload will be disabled.
}

interface UseDocumentManagerParams {
    candidateId: string;
}

interface DocumentManagerState {
    documents: CandidateDocument[];
    setDocuments: React.Dispatch<React.SetStateAction<CandidateDocument[]>>;
    showPdf: boolean;
    pdfUrl: string | null;
    pdfTitle: string;
    showAddDoc: boolean;
    addDocLabel: string;
    addDocCustomLabel: string;
    addDocStep: 'label' | 'uploading';
    addDocError: string | null;
    hasDocumentPicker: boolean;
    setShowPdf: (v: boolean) => void;
    setShowAddDoc: (v: boolean) => void;
    setAddDocLabel: (v: string) => void;
    setAddDocCustomLabel: (v: string) => void;
    loadDocuments: () => Promise<CandidateDocument[]>;
    handleViewDocument: (doc: CandidateDocument) => Promise<void>;
    openPdfViewer: (url: string, title: string) => void;
    handleDeleteDocument: (doc: CandidateDocument) => void;
    handleSelectLabel: (label: string) => Promise<void>;
    pickAndUploadDocument: (label: string) => Promise<void>;
    openAddDocSheet: () => void;
}

export function useDocumentManager({ candidateId }: UseDocumentManagerParams): DocumentManagerState {
    const [documents, setDocuments] = useState<CandidateDocument[]>([]);
    const [showPdf, setShowPdf] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [showAddDoc, setShowAddDoc] = useState(false);
    const [addDocLabel, setAddDocLabel] = useState('');
    const [addDocCustomLabel, setAddDocCustomLabel] = useState('');
    const [addDocStep, setAddDocStep] = useState<'label' | 'uploading'>('label');
    const [addDocError, setAddDocError] = useState<string | null>(null);

    const loadDocuments = useCallback(async () => {
        const { data } = await fetchCandidateDocuments(candidateId);
        setDocuments(data);
        return data;
    }, [candidateId]);

    const openPdfViewer = useCallback((url: string, title: string) => {
        setPdfUrl(url);
        setPdfTitle(title);
        setShowPdf(true);
    }, []);

    const handleViewDocument = useCallback(
        async (doc: CandidateDocument) => {
            const url = await getCandidateDocumentUrl(doc.file_url);
            if (!url) {
                Alert.alert('Unable to open document', 'This file could not be loaded. Please try again.');
                return;
            }
            openPdfViewer(url, doc.label);
        },
        [openPdfViewer],
    );

    const handleDeleteDocument = useCallback(
        (doc: CandidateDocument) => {
            const snapshot = [...documents];
            setDocuments((p) => p.filter((d) => d.id !== doc.id));
            deleteCandidateDocument(doc.id).catch(() => {
                setDocuments(snapshot);
            });
        },
        [documents],
    );

    const pickAndUploadDocument = useCallback(
        async (label: string) => {
            if (!DocumentPicker) return;
            setAddDocError(null);
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets[0]) return;

            const asset = result.assets[0];
            setAddDocStep('uploading');

            const { data: newDoc, error } = await uploadCandidateDocument(candidateId, label, asset.uri, asset.name);
            setAddDocStep('label');
            if (newDoc) {
                setDocuments((prev) => [newDoc, ...prev]);
                setShowAddDoc(false);
                setAddDocLabel('');
                setAddDocCustomLabel('');
            } else {
                setAddDocError(error ?? 'Upload failed');
            }
        },
        [candidateId],
    );

    const handleSelectLabel = useCallback(
        async (label: string) => {
            if (label === 'Other') {
                setAddDocLabel('Other');
                return;
            }
            await pickAndUploadDocument(label);
        },
        [pickAndUploadDocument],
    );

    const openAddDocSheet = useCallback(() => {
        setAddDocLabel('');
        setAddDocCustomLabel('');
        setAddDocError(null);
        setAddDocStep('label');
        setShowAddDoc(true);
    }, []);

    return {
        documents,
        setDocuments,
        showPdf,
        pdfUrl,
        pdfTitle,
        showAddDoc,
        addDocLabel,
        addDocCustomLabel,
        addDocStep,
        addDocError,
        hasDocumentPicker: !!DocumentPicker,
        setShowPdf,
        setShowAddDoc,
        setAddDocLabel,
        setAddDocCustomLabel,
        loadDocuments,
        handleViewDocument,
        openPdfViewer,
        handleDeleteDocument,
        handleSelectLabel,
        pickAndUploadDocument,
        openAddDocSheet,
    };
}
