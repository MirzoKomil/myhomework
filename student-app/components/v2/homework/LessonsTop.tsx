/**
 * Exams/Bonus dizaynidagi ustki qism: "Darslar" sarlavhasi, "x / 72 tugadi"
 * va Yo'l · Imtihonlar · Bonus tablari (Path ekrani bilan bir xil o'lchamlar).
 */
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { R } from '@/constants/v2/routes';

import { Txt, webShadow } from './ui';

type Tab = 'path' | 'exams' | 'bonus';

export function LessonsTop({ active, done, total, bonusDot }: { active: Tab; done: number | null; total: number; bonusDot?: boolean }) {
  const insets = useSafeAreaInsets();
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: 'path', label: 'Yoʻl', href: R.path },
    { key: 'exams', label: 'Imtihonlar', href: R.exams },
    { key: 'bonus', label: 'Bonus', href: R.bonus },
  ];
  return (
    <View style={[st.top, { paddingTop: insets.top + 14 }]}>
      <View style={st.titleRow}>
        <Txt f="display" size={30} lh={30} style={{ letterSpacing: -0.6 }} accessibilityRole="header">
          Darslar
        </Txt>
        <Txt f="bodyBold" size={14} color="#4A5468">
          {done ?? 0} / {total} tugadi
        </Txt>
      </View>
      <View accessibilityRole="tablist" style={st.tabs}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => !on && router.replace(t.href as Href)}
              style={[st.tab, on && st.tabOn, on && webShadow('0 1px 3px rgba(11,18,32,0.08)')]}
            >
              <Txt f={on ? 'bodyHeavy' : 'bodyBold'} size={14} color={on ? '#0B1220' : '#4A5468'}>
                {t.label}
              </Txt>
              {t.key === 'bonus' && bonusDot && !on && <View accessibilityLabel="yangi" style={st.dot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 14, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', backgroundColor: '#E7EBF3', borderRadius: 16, padding: 4, gap: 4 },
  tab: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabOn: { backgroundColor: '#FFFFFF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A1A' },
});
