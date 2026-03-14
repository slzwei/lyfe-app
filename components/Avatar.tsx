import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
    name: string;
    avatarUrl?: string | null;
    size: number;
    backgroundColor: string;
    textColor: string;
}

export default function Avatar({ name, avatarUrl, size, backgroundColor, textColor }: AvatarProps) {
    const initial = name?.charAt(0)?.toUpperCase() || '?';
    const fontSize = size * 0.4;
    const borderRadius = size / 2;
    const [imgError, setImgError] = useState(false);

    // Reset error state when URL changes (e.g. after re-upload)
    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    if (avatarUrl && !imgError) {
        return (
            <Image
                source={{ uri: avatarUrl }}
                style={{ width: size, height: size, borderRadius }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <View style={[styles.circle, { width: size, height: size, borderRadius, backgroundColor }]}>
            <Text style={[styles.initial, { color: textColor, fontSize }]}>{initial}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    initial: {
        fontWeight: '800',
    },
});
