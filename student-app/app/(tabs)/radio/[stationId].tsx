import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setWaveHeights(randomWave()), WAVE_INTERVAL);
    return () => clearInterval(id);
  }, [isPlaying]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Radio"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />
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

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogFlag}>{station.flag}</Text>
            <Text style={styles.dialogTitle}>{station.name}</Text>
            <View style={styles.dialogLiveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.dialogLiveText}>To'g'ridan-to'g'ri jonli efirda ishlaydi</Text>
            </View>
            <View style={styles.dialogRow}>
              <Ionicons name="location-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.dialogRowText}>{station.location}</Text>
            </View>
            <View style={styles.dialogRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.dialogRowText}>{station.founded}</Text>
            </View>
            <Text style={styles.dialogAbout}>{station.about}</Text>
            <Pressable style={styles.dialogBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.dialogBtnText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
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

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogFlag: { fontSize: 36 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, textAlign: 'center' },
  dialogLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 4,
  },
  dialogLiveText: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.danger },
  dialogRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  dialogRowText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  dialogAbout: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'left', lineHeight: 20, marginTop: 4 },
  dialogBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
