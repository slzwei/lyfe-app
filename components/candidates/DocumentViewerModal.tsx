import { getDocumentKind } from '@/lib/recruitment/documentKind';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';

interface Props {
    visible: boolean;
    url: string | null;
    title: string;
    /** Original file name — decides how the document renders (pdf / image / other). */
    fileName?: string | null;
    colors: ThemeColors;
    onClose: () => void;
}

const HEADER_HEIGHT = 56;

function DocumentViewerModal({ visible, url, title, fileName, colors, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const kind = getDocumentKind(fileName);

    // Reset transient state whenever a new document is opened.
    useEffect(() => {
        if (visible) {
            setErrorMsg(null);
            setLoading(true);
        }
    }, [visible, url]);

    const handleClose = () => {
        setErrorMsg(null);
        setLoading(true);
        onClose();
    };

    const openExternally = () => {
        if (url) Linking.openURL(url).catch(() => undefined);
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        onPress={handleClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* Load failure — offer an external open as a fallback */}
                {errorMsg && (
                    <View style={styles.messageBox}>
                        <Ionicons name="alert-circle-outline" size={36} color="#FFF" />
                        <Text style={styles.messageTitle}>Could not load document</Text>
                        <Text style={styles.messageBody}>{errorMsg}</Text>
                        {url && (
                            <TouchableOpacity
                                style={[styles.openBtn, { backgroundColor: colors.accent }]}
                                onPress={openExternally}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="open-outline" size={16} color={colors.textInverse} />
                                <Text style={[styles.openBtnText, { color: colors.textInverse }]}>Open in browser</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* PDF */}
                {url && !errorMsg && kind === 'pdf' && (
                    <View style={{ flex: 1 }}>
                        <Pdf
                            source={{ uri: url, cache: false }}
                            style={styles.pdf}
                            trustAllCerts={false}
                            onLoadComplete={() => setLoading(false)}
                            onError={(err) => {
                                const message = err instanceof Error ? err.message : String(err);
                                setErrorMsg(message);
                                setLoading(false);
                                if (__DEV__) console.warn('[DocumentViewer] pdf onError', err);
                            }}
                        />
                        {loading && (
                            <View style={styles.loadingOverlay} pointerEvents="none">
                                <ActivityIndicator size="large" color="#FFF" />
                            </View>
                        )}
                    </View>
                )}

                {/* Image — pinch-to-zoom on iOS via ScrollView; contain-fit on both platforms */}
                {url && !errorMsg && kind === 'image' && (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={styles.imageScroll}
                            maximumZoomScale={5}
                            minimumZoomScale={1}
                            centerContent
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                        >
                            <Image
                                testID="document-image"
                                source={{ uri: url }}
                                style={{ width, height: Math.max(height - insets.top - HEADER_HEIGHT, 1) }}
                                resizeMode="contain"
                                onLoadEnd={() => setLoading(false)}
                                onError={() => {
                                    setErrorMsg('This image could not be loaded.');
                                    setLoading(false);
                                }}
                            />
                        </ScrollView>
                        {loading && (
                            <View style={styles.loadingOverlay} pointerEvents="none">
                                <ActivityIndicator size="large" color="#FFF" />
                            </View>
                        )}
                    </View>
                )}

                {/* Other (doc/docx/etc.) — no native preview, hand off to the system */}
                {url && !errorMsg && kind === 'other' && (
                    <View style={styles.messageBox}>
                        <Ionicons name="document-text-outline" size={44} color="#FFF" />
                        <Text style={styles.messageTitle}>Preview not available</Text>
                        <Text style={styles.messageBody}>
                            {fileName ? `"${fileName}" ` : 'This file '}
                            can&apos;t be previewed in the app. Open it to view or download.
                        </Text>
                        <TouchableOpacity
                            style={[styles.openBtn, { backgroundColor: colors.accent }]}
                            onPress={openExternally}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="open-outline" size={16} color={colors.textInverse} />
                            <Text style={[styles.openBtnText, { color: colors.textInverse }]}>Open</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: '#1C1C1E',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        color: '#FFF',
    },
    pdf: {
        flex: 1,
        backgroundColor: '#000',
    },
    imageScroll: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 12,
    },
    messageTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    messageBody: {
        color: '#CCC',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    openBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 8,
    },
    openBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

export default React.memo(DocumentViewerModal);
