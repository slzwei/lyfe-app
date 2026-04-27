import LiveEventBar from '@/components/LiveEventBar';
import OfflineBanner from '@/components/OfflineBanner';
import { TAB_BAR_HEIGHT, TAB_BAR_PADDING_BOTTOM, TAB_BAR_PADDING_TOP } from '@/constants/platform';
import { getVisibleTabs, type UserRole } from '@/constants/Roles';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: 'home-outline',
    leads: 'people-outline',
    roadmap: 'map-outline',
    candidates: 'document-text-outline',
    team: 'briefcase-outline',
    events: 'calendar-outline',
    pa: 'clipboard-outline',
    admin: 'settings-outline',
    profile: 'person-outline',
};

const TAB_ICONS_FOCUSED: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: 'home',
    leads: 'people',
    roadmap: 'map',
    candidates: 'document-text',
    team: 'briefcase',
    events: 'calendar',
    pa: 'clipboard',
    admin: 'settings',
    profile: 'person',
};

const TAB_LABELS: Record<string, string> = {
    home: 'Home',
    leads: 'Leads',
    roadmap: 'Roadmap',
    candidates: 'Candidates',
    team: 'Team',
    events: 'Events',
    pa: 'Candidates',
    admin: 'Admin',
    profile: 'Profile',
};

export default function TabLayout() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode } = useViewMode();

    const role: UserRole = user?.role || 'agent';
    const visibleTabs = getVisibleTabs(role, viewMode);
    const insets = useSafeAreaInsets();

    // On Android, add the navigation bar inset so the tab bar sits above
    // the system 3-button / gesture nav bar. iOS values are untouched.
    const navBarInset = Platform.OS === 'android' ? insets.bottom : 0;

    return (
        <View style={{ flex: 1 }}>
            <OfflineBanner />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: colors.tabIconSelected,
                    tabBarInactiveTintColor: colors.tabIconDefault,
                    tabBarStyle: {
                        backgroundColor: colors.tabBar,
                        borderTopColor: colors.tabBarBorder,
                        borderTopWidth: 0.5,
                        elevation: 0,
                        paddingBottom: TAB_BAR_PADDING_BOTTOM + navBarInset,
                        paddingTop: TAB_BAR_PADDING_TOP,
                        height: TAB_BAR_HEIGHT + navBarInset,
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '600',
                        letterSpacing: 0.2,
                    },
                }}
            >
                <Tabs.Screen
                    name="home"
                    options={{
                        title: TAB_LABELS.home,
                        href: visibleTabs.includes('home') ? undefined : null,
                        tabBarButtonTestID: 'tab-home',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.home : TAB_ICONS.home}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="leads"
                    options={{
                        title: TAB_LABELS.leads,
                        href: visibleTabs.includes('leads') ? undefined : null,
                        tabBarButtonTestID: 'tab-leads',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.leads : TAB_ICONS.leads}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="roadmap"
                    options={{
                        title: TAB_LABELS.roadmap,
                        href: visibleTabs.includes('roadmap') ? undefined : null,
                        tabBarButtonTestID: 'tab-roadmap',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.roadmap : TAB_ICONS.roadmap}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="candidates"
                    options={{
                        title: TAB_LABELS.candidates,
                        href: visibleTabs.includes('candidates') ? undefined : null,
                        tabBarButtonTestID: 'tab-candidates',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.candidates : TAB_ICONS.candidates}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="team"
                    options={{
                        title: TAB_LABELS.team,
                        href: visibleTabs.includes('team') ? undefined : null,
                        tabBarButtonTestID: 'tab-team',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.team : TAB_ICONS.team}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="events"
                    options={{
                        title: TAB_LABELS.events,
                        href: visibleTabs.includes('events') ? undefined : null,
                        tabBarButtonTestID: 'tab-events',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.events : TAB_ICONS.events}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="pa"
                    options={{
                        title: TAB_LABELS.pa,
                        href: visibleTabs.includes('pa') ? undefined : null,
                        tabBarButtonTestID: 'tab-pa',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? TAB_ICONS_FOCUSED.pa : TAB_ICONS.pa} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="admin"
                    options={{
                        title: TAB_LABELS.admin,
                        href: visibleTabs.includes('admin') ? undefined : null,
                        tabBarButtonTestID: 'tab-admin',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.admin : TAB_ICONS.admin}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                {/* Exams screens kept accessible for roadmap exam modules, but hidden from tab bar */}
                <Tabs.Screen name="exams" options={{ href: null }} />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: TAB_LABELS.profile,
                        href: visibleTabs.includes('profile') ? undefined : null,
                        tabBarButtonTestID: 'tab-profile',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                name={focused ? TAB_ICONS_FOCUSED.profile : TAB_ICONS.profile}
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
            </Tabs>
            <LiveEventBar />
        </View>
    );
}
