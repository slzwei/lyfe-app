import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : '';

interface Props {
    visible: boolean;
    pdfUrl: string | null;
    pdfTitle: string;
    colors: ThemeColors;
    onClose: () => void;
}

function PdfViewerModal({ visible, pdfUrl, pdfTitle, colors, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleClose = () => {
        setErrorMsg(null);
        onClose();
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
                        {pdfTitle}
                    </Text>
                    <View style={{ width: 32 }} />
                </View>
                {errorMsg && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle-outline" size={36} color="#FFF" />
                        <Text style={styles.errorTitle}>Could not load document</Text>
                        <Text style={styles.errorBody}>{errorMsg}</Text>
                    </View>
                )}
                {pdfUrl && !errorMsg && (
                    <WebView
                        source={{ uri: pdfUrl }}
                        style={{ flex: 1 }}
                        originWhitelist={SUPABASE_ORIGIN ? [SUPABASE_ORIGIN] : ['*']}
                        startInLoadingState
                        renderLoading={() => (
                            <ActivityIndicator size="large" color="#FFF" style={StyleSheet.absoluteFill} />
                        )}
                        onError={(e) => {
                            const { description, code } = e.nativeEvent;
                            setErrorMsg(`${description} (code ${code})`);
                            if (__DEV__) console.warn('[PdfViewer] onError', e.nativeEvent);
                        }}
                        onHttpError={(e) => {
                            const { statusCode, url } = e.nativeEvent;
                            setErrorMsg(`HTTP ${statusCode} — file not found in this environment's storage.`);
                            if (__DEV__) console.warn('[PdfViewer] onHttpError', { statusCode, url });
                        }}
                    />
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
    errorBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 12,
    },
    errorTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    errorBody: {
        color: '#CCC',
        fontSize: 14,
        textAlign: 'center',
    },
});

export default React.memo(PdfViewerModal);
