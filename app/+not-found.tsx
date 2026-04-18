import { useTheme } from '@/contexts/ThemeContext';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
    const { colors } = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>This screen doesn't exist.</Text>
                <Link href="/profile" style={[styles.link, { color: colors.accent }]}>
                    Go to home screen
                </Link>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
        fontSize: 14,
    },
});
