import type { ThemeColors } from '@/types/theme';
import type { CandidateDocument } from '@/types/recruitment';
import { DOCUMENT_LABELS } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

// ── Document List (inline in scroll) ──

export interface GeneratedPdf {
    label: string;
    title: string;
    onView: () => void;
}

interface DocumentListProps {
    documents: CandidateDocument[];
    generatedPdfs?: GeneratedPdf[];
    hasDocumentPicker: boolean;
    colors: ThemeColors;
    onViewDocument: (doc: CandidateDocument) => void;
    onDeleteDocument: (doc: CandidateDocument) => void;
    onAddDocument: () => void;
}

export function DocumentList({
    documents,
    generatedPdfs,
    hasDocumentPicker,
    colors,
    onViewDocument,
    onDeleteDocument,
    onAddDocument,
}: DocumentListProps) {
    const hasAny = (generatedPdfs && generatedPdfs.length > 0) || documents.length > 0;

    return (
        <>
            {!hasAny ? (
                <View style={docStyles.emptyState}>
                    {/* Icon in accent — empty states should be seen, not blend with cream */}
                    <Ionicons name="folder-open-outline" size={28} color={colors.accent} />
                    <Text style={[docStyles.emptyText, { color: colors.textSecondary }]}>No documents yet</Text>
                </View>
            ) : (
                <>
                    {generatedPdfs?.map((pdf) => (
                        <View key={pdf.label} style={[docStyles.docRow, { backgroundColor: colors.surfacePrimary }]}>
                            <View style={[docStyles.labelChip, { backgroundColor: colors.accentLight }]}>
                                <Text style={[docStyles.labelChipText, { color: colors.accent }]} numberOfLines={1}>
                                    {pdf.label}
                                </Text>
                            </View>
                            <Text style={[docStyles.docFileName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {pdf.title}
                            </Text>
                            <TouchableOpacity
                                style={[docStyles.viewBtn, { backgroundColor: colors.accent }]}
                                onPress={pdf.onView}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="eye-outline" size={14} color={colors.textInverse} />
                                <Text style={[docStyles.viewBtnText, { color: colors.textInverse }]}>View</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                    {documents.map((doc) => (
                        <View key={doc.id} style={[docStyles.docRow, { backgroundColor: colors.surfacePrimary }]}>
                            <View style={[docStyles.labelChip, { backgroundColor: colors.accentLight }]}>
                                <Text style={[docStyles.labelChipText, { color: colors.accent }]} numberOfLines={1}>
                                    {doc.label}
                                </Text>
                            </View>
                            <Text style={[docStyles.docFileName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {doc.file_name}
                            </Text>
                            <TouchableOpacity
                                style={[docStyles.viewBtn, { backgroundColor: colors.accent }]}
                                onPress={() => onViewDocument(doc)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="eye-outline" size={14} color={colors.textInverse} />
                                <Text style={[docStyles.viewBtnText, { color: colors.textInverse }]}>View</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onDeleteDocument(doc)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ marginLeft: 6 }}
                            >
                                <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </>
            )}

            <TouchableOpacity
                style={[docStyles.addBtn, { borderColor: colors.accent, opacity: !hasDocumentPicker ? 0.4 : 1 }]}
                onPress={onAddDocument}
                activeOpacity={0.7}
                disabled={!hasDocumentPicker}
            >
                <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                <Text style={[docStyles.addBtnText, { color: colors.accent }]}>Add Document</Text>
            </TouchableOpacity>
        </>
    );
}

// ── Add Document Sheet (Modal) ──

interface AddDocumentSheetProps {
    visible: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    addDocStep: 'label' | 'uploading';
    addDocLabel: string;
    addDocCustomLabel: string;
    addDocError: string | null;
    onClose: () => void;
    onSelectLabel: (label: string) => void;
    onCustomLabelChange: (v: string) => void;
    onPickAndUpload: (label: string) => void;
}

export function AddDocumentSheet({
    visible,
    colors,
    animatedStyle,
    addDocStep,
    addDocLabel,
    addDocCustomLabel,
    addDocError,
    onClose,
    onSelectLabel,
    onCustomLabelChange,
    onPickAndUpload,
}: AddDocumentSheetProps) {
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose}>
                    <Animated.View
                        style={[docStyles.addSheet, { backgroundColor: colors.cardBackground }, animatedStyle]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />
                        <Text style={[sheetStyles.sheetTitle, { color: colors.textPrimary }]}>
                            {addDocStep === 'uploading' ? 'Uploading...' : 'Add Document'}
                        </Text>

                        {addDocError && (
                            <View style={[errorStyles.errorRow, { backgroundColor: ERROR_BG }]}>
                                <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                                <Text style={errorStyles.errorText}>{addDocError}</Text>
                            </View>
                        )}

                        {addDocStep === 'uploading' ? (
                            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                <Ionicons name="cloud-upload-outline" size={40} color={colors.accent} />
                                <Text style={[{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }]}>
                                    Uploading PDF...
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Text style={[docStyles.pickerHint, { color: colors.textTertiary }]}>
                                    Select a document type, then pick a PDF
                                </Text>
                                <View style={docStyles.labelGrid}>
                                    {DOCUMENT_LABELS.map((lbl) => (
                                        <TouchableOpacity
                                            key={lbl}
                                            style={[
                                                docStyles.labelPill,
                                                {
                                                    backgroundColor:
                                                        addDocLabel === lbl ? colors.accent : colors.surfacePrimary,
                                                },
                                            ]}
                                            onPress={() => onSelectLabel(lbl)}
                                            activeOpacity={0.75}
                                        >
                                            <Text
                                                style={[
                                                    docStyles.labelPillText,
                                                    {
                                                        color:
                                                            addDocLabel === lbl
                                                                ? colors.textInverse
                                                                : colors.textSecondary,
                                                    },
                                                ]}
                                            >
                                                {lbl}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {addDocLabel === 'Other' && (
                                    <>
                                        <TextInput
                                            style={[
                                                inputStyles.input,
                                                {
                                                    color: colors.textPrimary,
                                                    backgroundColor: colors.surfacePrimary,
                                                    width: '100%',
                                                },
                                            ]}
                                            placeholder="Document name (e.g. BCP Certificate)"
                                            placeholderTextColor={colors.textTertiary}
                                            value={addDocCustomLabel}
                                            onChangeText={onCustomLabelChange}
                                            autoFocus
                                        />
                                        <TouchableOpacity
                                            style={[
                                                sheetStyles.primaryBtn,
                                                {
                                                    backgroundColor: colors.accent,
                                                    opacity: addDocCustomLabel.trim() ? 1 : 0.4,
                                                },
                                            ]}
                                            onPress={() => onPickAndUpload(addDocCustomLabel.trim())}
                                            disabled={!addDocCustomLabel.trim()}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons
                                                name="cloud-upload-outline"
                                                size={18}
                                                color={colors.textInverse}
                                            />
                                            <Text style={[sheetStyles.primaryBtnText, { color: colors.textInverse }]}>
                                                Pick PDF
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </>
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ── Styles ──

const sheetStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 24,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 20,
    },
    primaryBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 14,
        marginBottom: 10,
        minHeight: 52,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
});

const docStyles = StyleSheet.create({
    emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
    emptyText: { fontSize: 13 },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 8,
        gap: 8,
    },
    labelChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        maxWidth: 90,
    },
    labelChipText: { fontSize: 12, fontWeight: '700' },
    docFileName: { flex: 1, fontSize: 13 },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    viewBtnText: { fontSize: 13, fontWeight: '600' },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        marginTop: 4,
    },
    addBtnText: { fontSize: 14, fontWeight: '600' },
    addSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 12,
        alignItems: 'center',
    },
    pickerHint: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
    labelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 16,
        width: '100%',
    },
    labelPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    labelPillText: { fontSize: 14, fontWeight: '600' },
});

const errorStyles = StyleSheet.create({
    errorRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: { fontSize: 13, color: ERROR_TEXT, flex: 1 },
});

const inputStyles = StyleSheet.create({
    input: {
        width: '100%',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 16,
    },
});
