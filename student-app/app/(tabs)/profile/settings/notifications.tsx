import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushSubscribed,
  isPushSupported,
} from '@/services/pushNotifications';

type ToggleKey = 'lessons' | 'news' | 'messages';

export default function NotificationSettingsScreen() {
  const [values, setValues] = useState<Record<ToggleKey, boolean>>({
    lessons: true,
    news: false,
    messages: false,
  });

  const pushSupported = isPushSupported();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported) return;
    isPushSubscribed().then(setPushEnabled);
  }, [pushSupported]);

  const togglePush = async (v: boolean) => {
    setPushError(null);
    setPushBusy(true);
    try {
      if (v) {
        const res = await enablePushNotifications();
        if (res.ok) {
          setPushEnabled(true);
        } else {
          setPushError(res.error ?? 'Xatolik yuz berdi');
        }
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const rows: { key: ToggleKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'lessons', icon: 'book-outline', label: 'Darslar' },
    { key: 'news', icon: 'newspaper-outline', label: 'Yangiliklar' },
    { key: 'messages', icon: 'chatbubble-outline', label: 'Xabarlar' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bildirishnoma" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {pushSupported && (
          <>
            <Text style={styles.sectionLabel}>Qurilma bildirishnomalari</Text>
            <View style={styles.group}>
              <View style={styles.row}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.purple} />
                <Text style={styles.rowLabel}>Ilova yopiq bo'lsa ham bildirishnoma kelsin</Text>
                {pushBusy ? (
                  <ActivityIndicator color={theme.colors.purple} />
                ) : (
                  <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: theme.colors.purple }} />
                )}
              </View>
            </View>
            {pushError && <Text style={styles.errorText}>{pushError}</Text>}
            <View style={{ height: 20 }} />
          </>
        )}
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
  sectionLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: 8,
  },
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
