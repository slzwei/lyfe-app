import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface Props {
    visible: boolean;
    pdfUrl: string | null;
    pdfTitle: string;
    colors: ThemeColors;
    onClose: () => void;
}

function PdfViewerModal({ visible, pdfUrl, pdfTitle, colors, onClose }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        onPress={onClose}
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
                {pdfUrl && (
                    <WebView
                        source={{ uri: pdfUrl }}
                        style={{ flex: 1 }}
                        originWhitelist={['https://nvtedkyjwulkzjeoqjgx.supabase.co']}
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
});

export default React.memo(PdfViewerModal);
