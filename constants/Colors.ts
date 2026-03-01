/**
 * Lyfe App — iOS-Native Color System
 * Accent: Deep Teal #0A7E6B
 * Inspired by Apple Health, iOS Settings, Notion
 *
 * Design principles:
 * - Restrained color — accent only for interactive elements
 * - iOS system backgrounds (#F2F2F7 grouped, #FFFFFF cards)
 * - No card borders — contrast between bg layers
 * - Typography-driven hierarchy
 */

const teal = {
  primary: '#0A7E6B',
  light: '#E8F5F2',
  dark: '#06594C',
  muted: '#7BBFB3',
};

export const Colors = {
  light: {
    // Backgrounds — iOS system grouped
    background: '#F2F2F7',
    surfacePrimary: '#FFFFFF',
    surfaceSecondary: '#F2F2F7',
    surfaceElevated: '#FFFFFF',

    // Text — true black hierarchy
    textPrimary: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',
    textInverse: '#FFFFFF',

    // Accent — deep teal
    accent: teal.primary,
    accentLight: teal.light,
    accentDark: teal.dark,
    accentMuted: teal.muted,

    // Semantic
    success: '#34C759',
    successLight: '#E8F9ED',
    warning: '#FF9500',
    warningLight: '#FFF4E5',
    danger: '#FF3B30',
    dangerLight: '#FFEDEC',
    info: '#007AFF',
    infoLight: '#E5F1FF',

    // Borders & Dividers
    border: '#E5E5EA',
    borderLight: '#F2F2F7',
    divider: '#C6C6C8',

    // Cards & Components — borderless design
    cardBackground: '#FFFFFF',
    cardBorder: 'transparent',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E5E5EA',
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5EA',

    // Status pills — muted tones
    statusNew: '#007AFF',
    statusContacted: '#FF9500',
    statusQualified: '#34C759',
    statusProposed: '#AF52DE',
    statusWon: '#34C759',
    statusLost: '#FF3B30',

    // Shadows (iOS)
    shadow: 'rgba(0, 0, 0, 0.04)',

    // Tab bar icons
    tabIconDefault: '#8E8E93',
    tabIconSelected: teal.primary,
  },
  dark: {
    // Backgrounds — true black
    background: '#000000',
    surfacePrimary: '#1C1C1E',
    surfaceSecondary: '#000000',
    surfaceElevated: '#2C2C2E',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#8E8E93',
    textInverse: '#000000',

    // Accent
    accent: '#2EAF97',
    accentLight: '#1A2E2A',
    accentDark: teal.primary,
    accentMuted: '#3D7A6F',

    // Semantic
    success: '#30D158',
    successLight: '#0E2916',
    warning: '#FF9F0A',
    warningLight: '#2A1F0A',
    danger: '#FF453A',
    dangerLight: '#2D1214',
    info: '#0A84FF',
    infoLight: '#0A1A2D',

    // Borders & Dividers
    border: '#38383A',
    borderLight: '#2C2C2E',
    divider: '#38383A',

    // Cards & Components
    cardBackground: '#1C1C1E',
    cardBorder: 'transparent',
    tabBar: '#1C1C1E',
    tabBarBorder: '#38383A',
    inputBackground: '#2C2C2E',
    inputBorder: '#38383A',

    // Status pills
    statusNew: '#0A84FF',
    statusContacted: '#FF9F0A',
    statusQualified: '#30D158',
    statusProposed: '#BF5AF2',
    statusWon: '#30D158',
    statusLost: '#FF453A',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.5)',

    // Tab bar icons
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#2EAF97',
  },
};
