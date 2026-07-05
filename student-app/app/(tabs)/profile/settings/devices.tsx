import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const DEVICES = [
  { id: 'd1', name: 'iPhone 14 Pro', location: 'Toshkent, Uzbekiston', lastActive: 'Hozir faol', current: true },
  { id: 'd2', name: 'Chrome — Windows', location: 'Toshkent, Uzbekiston', lastActive: '2 kun oldin', current: false },
];

export default function DevicesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Faol qurilmalar" showBack />
      <View style={styles.list}>
        {DEVICES.map((d) => (
          <View key={d.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={d.id === 'd1' ? 'phone-portrait-outline' : 'desktop-outline'} size={22} color={theme.colors.purple} />
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{d.name}</Text>
                {d.current && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Joriy</Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>{d.location}</Text>
              <Text style={styles.meta}>{d.lastActive}</Text>
            </View>
            {!d.current && (
              <Pressable style={styles.logoutBtn}>
                <Text style={styles.logoutText}>Chiqish</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  currentBadge: { backgroundColor: theme.colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  currentBadgeText: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.success },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.dangerBg, borderRadius: 10 },
  logoutText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.danger },
});
