import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';

import Colors from '@/constants/Colors';
import { theme } from '@/constants/theme';
import { DESKTOP_BREAKPOINT, DESKTOP_CONTENT_MAX_WIDTH, DESKTOP_SIDEBAR_WIDTH, WEB_APP_MAX_WIDTH } from '@/constants/web';
import { useColorScheme } from '@/components/useColorScheme';
import { useLang } from '@/i18n/LanguageContext';

type TabIconName = keyof typeof Ionicons.glyphMap;

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? 72 : 68;

function TabIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as TabIconName)}
      size={26}
      color={color}
      style={focused ? styles.activeIcon : undefined}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  // 151-ish: keng brauzer oynasida (kompyuterdan kirilganda) pastki
  // tab-navigatsiya chap sidebar'ga aylanadi — Expo Router'ning Tabs
  // komponenti buni `tabBarPosition: 'left'` orqali tayyor qo'llab-
  // quvvatlaydi, alohida navigator yozish shart emas.
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const { t } = useLang();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: isDesktop,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: [
          styles.tabBar,
          Platform.OS === 'web' && !isDesktop && styles.tabBarWeb,
          isDesktop && styles.tabBarDesktop,
        ],
        sceneStyle: Platform.OS === 'web' ? (isDesktop ? styles.sceneDesktop : styles.sceneWeb) : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: t('nav_home'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          tabBarLabel: t('nav_lessons'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="school" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          tabBarLabel: t('nav_resources'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="library" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarLabel: t('nav_community'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="chatbubbles" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: t('nav_profile'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="radio" options={{ href: null }} />
      <Tabs.Screen name="translator" options={{ href: null }} />
      <Tabs.Screen name="battle" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="vocabulary" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : Platform.OS === 'web' ? 14 : 12,
    ...theme.shadow.card,
  },
  tabBarWeb: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    maxWidth: WEB_APP_MAX_WIDTH,
    zIndex: 100,
  },
  // 151-ish: sidebar — Tabs `tabBarPosition:'left'` bilan bu elementni
  // oddiy flex-qatordagi chap "ustun" sifatida render qiladi (fixed emas),
  // shuning uchun kontent maydoni tabiiy ravishda qolgan kenglikni oladi.
  tabBarDesktop: {
    width: DESKTOP_SIDEBAR_WIDTH,
    height: '100%',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingTop: 28,
    paddingBottom: 16,
  },
  sceneWeb: {
    paddingBottom: TAB_BAR_HEIGHT,
    minHeight: '100dvh',
  },
  sceneDesktop: {
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
    marginHorizontal: 'auto',
    minHeight: '100dvh',
  },
  activeIcon: {
    transform: [{ scale: 1.05 }],
  },
});
