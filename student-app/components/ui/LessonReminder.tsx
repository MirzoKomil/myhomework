import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type LessonReminderProps = {
  topic: string;
  startsAt: string;
  telegramLink: string;
};

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Boshlandi';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
  return `${minutes} daqiqa`;
}

export function LessonReminder({ topic, startsAt, telegramLink }: LessonReminderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(startsAt).getTime() - now;

  return (
    <Pressable style={styles.card} onPress={() => Linking.openURL(telegramLink)}>
      <View style={styles.iconWrap}>
        <Ionicons name="videocam" size={22} color={theme.colors.blue} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>Navbatdagi live dars</Text>
        <Text style={styles.topic} numberOfLines={1}>{topic}</Text>
      </View>
      <View style={styles.countdownBadge}>
        <Text style={styles.countdownText}>{formatCountdown(diff)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.blueLight,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  label: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  topic: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  countdownBadge: {
    backgroundColor: theme.colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  countdownText: { fontFamily: theme.fonts.bold, fontSize: 12, color: '#fff' },
});
