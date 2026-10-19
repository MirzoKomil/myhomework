/**
 * Bosh sahifaning pastki menyusi — Main/DarkMain/Loading dizaynidagi nav
 * aynan (faol "Asosiy" ikonkasi chiziqli 2.4, qorong'u rejim ranglari).
 * Umumiy TabBar qorong'u rejimni bilmagani uchun shu yerda alohida.
 */
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { NavHomeIcon, NavPathIcon, NavStarIcon, NavUserIcon, TrophyIcon } from './icons';
import { lightHome, type HomePalette } from './palette';
import { v2Tab } from '@/services/v2Nav';

const ITEMS = [
  { key: 'home', label: 'Asosiy', href: R.home },
  { key: 'lessons', label: 'Darslar', href: R.path },
  { key: 'practice', label: 'Mashq', href: R.practice },
  { key: 'league', label: 'Liga', href: R.league },
  { key: 'profile', label: 'Profil', href: R.profile },
] as const;

export function HomeNav({ p = lightHome, inactiveColor, homeStroke = 2.4 }: { p?: HomePalette; inactiveColor?: string; homeStroke?: number }) {
  const insets = useSafeAreaInsets();
  const off = inactiveColor ?? p.navInactive;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Asosiy menyu"
      style={[styles.bar, { backgroundColor: p.navBg, borderTopColor: p.navBorder, paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      {ITEMS.map((it) => {
        const active = it.key === 'home';
        const c = active ? p.navActive : off;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            onPress={() => { if (!active) v2Tab(it.href); }}
            style={styles.item}
          >
            {it.key === 'home' && <NavHomeIcon color={c} fill="none" strokeWidth={homeStroke} />}
            {it.key === 'lessons' && <NavPathIcon color={c} />}
            {it.key === 'practice' && <NavStarIcon color={c} />}
            {it.key === 'league' && <TrophyIcon size={24} color={c} />}
            {it.key === 'profile' && <NavUserIcon color={c} />}
            <Text style={[styles.label, { color: c, fontFamily: active ? fonts.bodyHeavy : fonts.bodyBold }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 6 },
  item: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 12, fontWeight: 'normal' },
});
