import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type LessonReminderProps = {
  topic: string;
  startsAt: string;
  telegramLink: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function LessonReminder({ topic, startsAt, telegramLink }: LessonReminderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(startsAt).getTime() - now;

  return (
    <Pressable style={styles.wrap} onPress={() => Linking.openURL(telegramLink)}>
      <LinearGradient
        colors={['#F0807D', '#D65656']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.blobOne} />
        <View style={styles.blobTwo} />
        <View style={styles.topRow}>
          <View style={styles.left}>
            <View style={styles.iconRow}>
              <Ionicons name="alarm" size={22} color="#fff" />
              <Text style={styles.countdown}>{diff > 0 ? formatCountdown(diff) : 'Boshlandi'}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.topic} numberOfLines={1}>{topic}</Text>
          </View>
          <View style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#D65656" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 20,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -100,
    right: -40,
  },
  blobTwo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -60,
    right: 50,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flex: 1, paddingRight: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  countdown: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: '#fff', letterSpacing: 1 },
  divider: { height: 2, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1, marginBottom: 10 },
  topic: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
