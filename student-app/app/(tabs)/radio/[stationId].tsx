import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { radioStations } from '@/data/mock';

const BAR_COUNT = 20;
const WAVE_INTERVAL = 450;

function randomWave() {
  return Array.from({ length: BAR_COUNT }, () => 8 + Math.floor(Math.random() * 36));
}

export default function RadioPlayerScreen() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const station = radioStations.find((s) => s.id === stationId) ?? radioStations[0];
  const [isPlaying, setIsPlaying] = useState(true);
  const [waveHeights, setWaveHeights] = useState(randomWave);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setWaveHeights(randomWave()), WAVE_INTERVAL);
    return () => clearInterval(id);
  }, [isPlaying]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Radio" showBack />
      <View style={styles.content}>
        <LinearGradient
          colors={station.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}>
          <Text style={styles.coverFlag}>{station.flag}</Text>
        </LinearGradient>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>JONLI EFIR</Text>
        </View>

        <Text style={styles.name}>{station.name}</Text>
        <Text style={styles.genre}>{station.genre}</Text>

        <View style={styles.waveRow}>
          {waveHeights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height: isPlaying ? h : 6, backgroundColor: isPlaying ? station.colors[1] : theme.colors.border },
              ]}
            />
          ))}
        </View>

        <Pressable
          style={[styles.playBtn, { backgroundColor: station.colors[1] }]}
          onPress={() => setIsPlaying((p) => !p)}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },
  cover: {
    width: 220,
    height: 220,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...theme.shadow.card,
  },
  coverFlag: { fontSize: 72 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 14,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.danger },
  liveText: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.danger, letterSpacing: 0.5 },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text, marginBottom: 4 },
  genre: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 36 },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48, marginBottom: 36 },
  waveBar: { width: 4, borderRadius: 2 },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
});
