import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

type ToggleKey = 'lessons' | 'news' | 'messages';

export default function NotificationSettingsScreen() {
  const [values, setValues] = useState<Record<ToggleKey, boolean>>({
    lessons: true,
    news: false,
    messages: false,
  });

  const rows: { key: ToggleKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'lessons', icon: 'book-outline', label: 'Darslar' },
    { key: 'news', icon: 'newspaper-outline', label: 'Yangiliklar' },
    { key: 'messages', icon: 'chatbubble-outline', label: 'Xabarlar' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bildirishnoma" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          {rows.map((row, i) => (
            <View key={row.key} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <Ionicons name={row.icon} size={20} color={theme.colors.purple} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Switch
                value={values[row.key]}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [row.key]: v }))}
                trackColor={{ true: theme.colors.purple }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20 },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.text },
});
