import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function AdminScreen() {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Admin" />
            <View style={styles.placeholder}>
                <Ionicons name="settings-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                    Admin panel coming soon
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    placeholderText: { fontSize: 15 },
});
