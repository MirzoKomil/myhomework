import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const resources = [
  { icon: 'book' as const, title: "Grammatika qo'llanma", count: '24 mavzu', color: theme.colors.blue, bg: theme.colors.blueLight },
  { icon: 'headset' as const, title: 'Podkastlar', count: '48 ta', color: theme.colors.pink, bg: theme.colors.pinkBg },
  { icon: 'film' as const, title: 'Video materiallar', count: '36 ta', color: theme.colors.purple, bg: theme.colors.purpleLight },
  { icon: 'document' as const, title: 'PDF resurslar', count: '15 ta', color: theme.colors.warning, bg: theme.colors.warningBg },
  { icon: 'musical-notes' as const, title: 'Audio mashqlar', count: '62 ta', color: theme.colors.success, bg: theme.colors.successBg },
];

export default function ResourcesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Resurslar" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Qo'shimcha o'quv materiallari</Text>
        {resources.map((item) => (
          <Card key={item.title} style={styles.resourceCard}>
            <View style={styles.resourceRow}>
              <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>{item.title}</Text>
                <Text style={styles.resourceCount}>{item.count}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 4 },
  resourceCard: {},
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  resourceCount: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});
