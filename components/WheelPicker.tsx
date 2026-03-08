import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export const WHEEL_ITEM_H = 44;

interface WheelPickerProps {
    items: string[];
    selectedIndex: number;
    onChange: (index: number) => void;
    colors: any;
    width?: number;
    /** Show the per-column hairline selection indicator. Default true. */
    showIndicator?: boolean;
    /** Number of visible rows. Must be odd. Default 5. */
    visibleItems?: number;
}

export default function WheelPicker({
    items, selectedIndex, onChange, colors,
    width = 80, showIndicator = true, visibleItems = 5,
}: WheelPickerProps) {
    const scrollRef = useRef<ScrollView>(null);
    const padding = WHEEL_ITEM_H * Math.floor(visibleItems / 2);
    const [scrollY, setScrollY] = useState(selectedIndex * WHEEL_ITEM_H);

    React.useEffect(() => {
        const t = setTimeout(() => {
            scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
        }, 50);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEnd = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ITEM_H)));
        setScrollY(idx * WHEEL_ITEM_H);
        onChange(idx);
    };

    const centerIdx = scrollY / WHEEL_ITEM_H;

    const itemStyles = useMemo(() =>
        items.map((_, i) => {
            const dist = Math.abs(centerIdx - i);
            const isSelected = dist < 0.5;
            return {
                opacity: Math.max(0.15, 1 - dist * 0.45),
                fontSize: isSelected ? 22 : 16,
                fontWeight: (isSelected ? '700' : '400') as '700' | '400',
                color: isSelected ? colors.accent : colors.textPrimary,
            };
        }), [centerIdx, items.length, colors.accent, colors.textPrimary]
    );

    return (
        <View style={{ height: WHEEL_ITEM_H * visibleItems, width, overflow: 'hidden' }}>
            {showIndicator && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: padding,
                        left: 6,
                        right: 6,
                        height: WHEEL_ITEM_H,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                    }}
                />
            )}
            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={WHEEL_ITEM_H}
                decelerationRate="fast"
                onScroll={e => setScrollY(e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleEnd}
                onScrollEndDrag={handleEnd}
                contentContainerStyle={{ paddingVertical: padding }}
            >
                {items.map((item, i) => (
                    <View key={i} style={{ height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{
                            fontSize: itemStyles[i].fontSize,
                            fontWeight: itemStyles[i].fontWeight,
                            opacity: itemStyles[i].opacity,
                            color: itemStyles[i].color,
                            letterSpacing: -0.3,
                        }}>
                            {item}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
