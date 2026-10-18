/**
 * v2 pastki menyu (dizayn: 02 · Bosh sahifa).
 *
 * Hozircha v2'da faqat Bosh sahifa bor — qolgan bo'limlar eski ilova
 * ekranlariga olib boradi. Har bir bo'lim v2'da qurilgach, shu yerdagi
 * `href` almashtiriladi.
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/v2/tokens';
import { HomeIcon, PathIcon, StarIcon, TrophyIcon, UserIcon } from './Icons';
import { V2Text } from './Text';

export type TabKey = 'home' | 'lessons' | 'practice' | 'league' | 'profile';

const TABS: { key: TabKey; label: string; href: Href; icon: (color: string, active: boolean) => ReactNode }[] = [
  { key: 'home', label: 'Asosiy', href: '/v2', icon: (c, a) => <HomeIcon color={c} filled={a} /> },
  { key: 'lessons', label: 'Darslar', href: '/homework', icon: (c, a) => <PathIcon color={c} strokeWidth={a ? 2.4 : 2} /> },
  { key: 'practice', label: 'Mashq', href: '/resources', icon: (c, a) => <StarIcon color={c} strokeWidth={a ? 2.4 : 2} /> },
  { key: 'league', label: 'Liga', href: '/profile/leaderboard', icon: (c, a) => <TrophyIcon color={c} strokeWidth={a ? 2.4 : 2} /> },
  { key: 'profile', label: 'Profil', href: '/profile', icon: (c, a) => <UserIcon color={c} strokeWidth={a ? 2.4 : 2} /> },
];

export function TabBar({ active }: { active: TabKey }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const color = isActive ? colors.cobalt : colors.textSubtle;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => { if (!isActive) router.push(tab.href); }}
            style={styles.item}
          >
            {tab.icon(color, isActive)}
            <V2Text variant="tab" color={color} style={isActive ? styles.activeLabel : undefined}>
              {tab.label}
            </V2Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  activeLabel: { fontFamily: fonts.bodyHeavy },
});
