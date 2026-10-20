/**
 * To'liq ekranli yuklanish skeleti (dizayn: Loading.dc.html).
 * Ma'lumot kelguncha boshqa ekranlar ham shu komponentni ko'rsatishi mumkin.
 * `withNav={false}` — pastki menyusiz ekranlar uchun.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DLoading } from '@/components/v2/desktop/home/DStates';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { HomeNav } from '@/components/v2/home/HomeNav';
import { SpinnerIcon } from '@/components/v2/home/icons';
import { fonts } from '@/constants/v2/tokens';

// CSS: linear-gradient(100deg, A 20%, B 42%, A 64%)
const LIGHT = ['#E6EAF2', '#F1F4F9', '#E6EAF2'] as const;
const DARK = ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0.10)'] as const;
const LOCS = [0.2, 0.42, 0.64] as const;

function Bone({ w, h, r, dark, style }: { w: DimensionValue; h: number; r: number; dark?: boolean; style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={dark ? DARK : LIGHT}
      locations={LOCS}
      start={{ x: 0, y: 0.41 }}
      end={{ x: 1, y: 0.59 }}
      style={[{ width: w, height: h, borderRadius: r, flexShrink: 0 }, style]}
    />
  );
}

const Plain = ({ w, h, r, bg }: { w: DimensionValue; h: number; r: number; bg: string }) => (
  <View style={{ width: w, height: h, borderRadius: r, backgroundColor: bg }} />
);

export function Loading(props: { withNav?: boolean }) {
  // Kompyuterda — D_Loading (yon menyu yonidagi joyda).
  return useIsDesktop() ? <DLoading /> : <LoadingMobile {...props} />;
}

function LoadingMobile({ withNav = true }: { withNav?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen} accessibilityState={{ busy: true }}>
      <ScrollView scrollEnabled={false} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 10 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.column}>
          <View style={styles.header}>
            <Bone w={44} h={44} r={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Bone w={70} h={10} r={5} />
              <Bone w={110} h={16} r={8} />
            </View>
            <Bone w={52} h={44} r={22} />
            <Bone w={70} h={44} r={22} />
            <Bone w={44} h={44} r={22} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCircle} />
            <Plain w={120} h={24} r={10} bg="rgba(255,255,255,0.55)" />
            <Plain w={190} h={24} r={8} bg="rgba(255,255,255,0.45)" />
            <Plain w={150} h={24} r={8} bg="rgba(255,255,255,0.45)" />
            <Plain w={210} h={12} r={6} bg="rgba(255,255,255,0.35)" />
            <View style={{ marginTop: 'auto' }}>
              <Plain w="100%" h={54} r={18} bg="rgba(255,255,255,0.7)" />
            </View>
          </View>

          <View style={styles.live}>
            <View style={{ flex: 1, gap: 8 }}>
              <Bone w={150} h={10} r={5} dark />
              <Bone w={130} h={26} r={8} dark />
              <Bone w={170} h={10} r={5} dark />
            </View>
            <Bone w={110} h={52} r={16} dark />
          </View>

          <View style={styles.goal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Bone w={56} h={56} r={28} />
              <View style={{ flex: 1, gap: 8 }}>
                <Bone w={110} h={14} r={7} />
                <Bone w={180} h={12} r={6} />
              </View>
            </View>
            <View style={styles.days}>
              {Array.from({ length: 7 }, (_, i) => (
                <View key={i} style={styles.day}>
                  <Bone w={32} h={32} r={16} />
                  <Bone w={18} h={10} r={5} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.quickRow}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.quick}>
                <Bone w={40} h={40} r={13} />
                <Bone w="80%" h={14} r={7} />
                <Bone w="55%" h={12} r={6} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Text accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={styles.srOnly}>Yuklanmoqda…</Text>
      <View style={styles.toastAnchor} pointerEvents="none">
        <View style={styles.toast}>
          <SpinnerIcon />
          <Text style={styles.toastText}>Yuklanmoqda…</Text>
        </View>
      </View>

      {withNav && <HomeNav />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { height: 236, backgroundColor: '#C9D5FF', borderRadius: 28, paddingVertical: 18, paddingHorizontal: 20, gap: 12, overflow: 'hidden' },
  heroCircle: { position: 'absolute', right: 18, top: 18, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.35)' },
  live: { height: 98, backgroundColor: '#1B2438', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  goal: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18, gap: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quick: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 12 },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  toastAnchor: { height: 0, position: 'relative', zIndex: 2 },
  toast: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(11,18,32,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toastText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
});
