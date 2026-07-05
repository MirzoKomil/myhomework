import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { theme } from '@/constants/theme';
import { WEB_APP_MAX_WIDTH } from '@/constants/web';
import { useColorScheme } from '@/components/useColorScheme';

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: [styles.tabBar, Platform.OS === 'web' && styles.tabBarWeb],
        sceneStyle: Platform.OS === 'web' ? styles.sceneWeb : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="school" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="library" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="sparkles" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="radio" options={{ href: null }} />
      <Tabs.Screen name="translator" options={{ href: null }} />
      <Tabs.Screen name="battle" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
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
  sceneWeb: {
    paddingBottom: TAB_BAR_HEIGHT,
    minHeight: '100dvh',
  },
  activeIcon: {
    transform: [{ scale: 1.05 }],
  },
});
