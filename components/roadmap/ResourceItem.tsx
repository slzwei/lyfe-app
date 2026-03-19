import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Touchable from '@/components/Touchable';
import { RESOURCE_TYPE_CONFIG } from '@/types/roadmap';
import type { RoadmapResource } from '@/types/roadmap';
import { displayWeight } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';

interface Props {
    resource: RoadmapResource;
    colors: ThemeColors;
}

function ResourceItem({ resource, colors }: Props) {
    const config = RESOURCE_TYPE_CONFIG[resource.resource_type];

    const handlePress = async () => {
        if (resource.content_url) {
            try {
                await Linking.openURL(resource.content_url);
            } catch {
                Alert.alert('Unable to Open', 'Could not open this resource.');
            }
        }
    };

    const isLinkable = resource.resource_type !== 'text' && !!resource.content_url;

    const inner = (
        <>
            <View style={[styles.iconContainer, { backgroundColor: colors.accent + '14' }]}>
                <Ionicons name={config.icon} size={20} color={colors.accent} />
            </View>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {resource.title}
                </Text>
                {resource.description ? (
                    <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                        {resource.description}
                    </Text>
                ) : null}
                <Text style={[styles.type, { color: colors.textTertiary }]}>{config.label}</Text>
            </View>
            {isLinkable && (
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={styles.chevron} />
            )}
        </>
    );

    if (!isLinkable) {
        return <View style={[styles.container, { backgroundColor: colors.surfacePrimary }]}>{inner}</View>;
    }

    return (
        <Touchable
            style={[styles.container, { backgroundColor: colors.surfacePrimary }]}
            onPress={handlePress}
            activeOpacity={0.7}
            accessibilityHint="Opens external link"
        >
            {inner}
        </Touchable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: displayWeight('600'),
        marginBottom: 2,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 2,
    },
    type: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chevron: {
        marginLeft: 8,
    },
});

export default React.memo(ResourceItem);
