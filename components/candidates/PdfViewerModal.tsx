import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface Props {
    visible: boolean;
    pdfUrl: string | null;
    pdfTitle: string;
    colors: ThemeColors;
    onClose: () => void;
}

function PdfViewerModal({ visible, pdfUrl, pdfTitle, colors, onClose }: Props) {
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.textPrimary }}>
                <View style={[styles.header, { backgroundColor: colors.surfacePrimary }]}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="chevron-down" size={24} color={colors.textInverse} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textInverse }]} numberOfLines={1}>
                        {pdfTitle}
                    </Text>
                    <View style={{ width: 32 }} />
                </View>
                {pdfUrl && (
                    <WebView source={{ uri: pdfUrl }} style={{ flex: 1 }} originWhitelist={['https://*.supabase.co']} />
                )}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default React.memo(PdfViewerModal);
