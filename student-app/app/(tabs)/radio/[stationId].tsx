import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { radioStations } from '@/data/mock';
import { fetchHomeworkRadioSchedule, getActiveHomeworkRadioBlock } from '@/services/contentApi';
import { resolveStationStreamCandidates } from '@/services/radioStreams';

const BAR_COUNT = 20;
const WAVE_INTERVAL = 450;
const CANDIDATE_TIMEOUT_MS = 8000;
const HW_RADIO_POLL_MS = 30000;

function randomWave() {
  return Array.from({ length: BAR_COUNT }, () => 8 + Math.floor(Math.random() * 36));
}

// Homework Radio — tashqi jonli oqimga ulanmaydi, o'rniga 144-ish'da CRM'dan
// yuklangan real audio jadvaliga (haqiqiy sana + soat oralig'i) ulanadi.
// Hozirgi vaqtga mos klip topilmasa, radio jim turadi.
const STATIC_DEMO_ID = 'homework-radio';

type PlaybackState = 'resolving' | 'buffering' | 'playing' | 'paused' | 'error' | 'silent';

export default function RadioPlayerScreen() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const station = radioStations.find((s) => s.id === stationId) ?? radioStations[0];
  const isStaticDemo = station.id === STATIC_DEMO_ID;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>('resolving');
  const [waveHeights, setWaveHeights] = useState(randomWave);
  const [showInfo, setShowInfo] = useState(false);
  const [activeBlockTitle, setActiveBlockTitle] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const cancelledRef = useRef(false);
  const activeBlockIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nomzodlar ro'yxatidagi bittasi ishlamasa (xato beradi yoki belgilangan
  // vaqt ichida jonli oqim boshlanmasa — masalan HLS Chrome'da), avtomatik
  // ravishda keyingi nomzodga o'tadi. Faqat hammasi tugagandan keyin xato
  // holatiga o'tkaziladi.
  const tryCandidate = (candidates: string[], index: number) => {
    if (cancelledRef.current) return;
    if (index >= candidates.length) {
      setPlayback('error');
      return;
    }
    const player = createAudioPlayer(candidates[index]);
    playerRef.current = player;

    const advance = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      player.remove();
      if (playerRef.current === player) playerRef.current = null;
      tryCandidate(candidates, index + 1);
    };

    timeoutRef.current = setTimeout(() => {
      if (cancelledRef.current || playerRef.current !== player) return;
      advance();
    }, CANDIDATE_TIMEOUT_MS);

    player.addListener('playbackStatusUpdate', (status) => {
      if (cancelledRef.current || playerRef.current !== player) return;
      if (status.error) {
        advance();
        return;
      }
      if (status.playing) {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        setPlayback('playing');
        setIsPlaying(true);
        return;
      }
      if (status.isBuffering) {
        setPlayback('buffering');
        return;
      }
      setPlayback('paused');
      setIsPlaying(false);
    });
    player.play();
  };

  // 144-ish: "Homework Radio" — real dastur jadvalidan hozirgi vaqtga mos
  // klipni topib qo'yadi. Hech narsa rejalashtirilmagan bo'lsa jim turadi.
  // Klip almashinishini ilg'ash uchun har HW_RADIO_POLL_MS'da qayta tekshiradi.
  const checkHomeworkRadioSchedule = () => {
    fetchHomeworkRadioSchedule()
      .then((schedule) => {
        if (cancelledRef.current) return;
        const block = getActiveHomeworkRadioBlock(schedule);
        if (!block) {
          if (activeBlockIdRef.current !== null) {
            playerRef.current?.remove();
            playerRef.current = null;
            activeBlockIdRef.current = null;
          }
          setPlayback('silent');
          setIsPlaying(false);
          setActiveBlockTitle(null);
          return;
        }
        if (block.id === activeBlockIdRef.current) return;
        playerRef.current?.remove();
        const player = createAudioPlayer(block.audioUrl);
        playerRef.current = player;
        activeBlockIdRef.current = block.id;
        setActiveBlockTitle(block.title);
        player.addListener('playbackStatusUpdate', (status) => {
          if (cancelledRef.current || playerRef.current !== player) return;
          if (status.error) {
            setPlayback('error');
            return;
          }
          if (status.playing) {
            setPlayback('playing');
            setIsPlaying(true);
            return;
          }
          if (status.isBuffering) {
            setPlayback('buffering');
            return;
          }
          setPlayback('paused');
          setIsPlaying(false);
        });
        player.play();
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isStaticDemo) return;
    cancelledRef.current = false;
    checkHomeworkRadioSchedule();
    pollIntervalRef.current = setInterval(checkHomeworkRadioSchedule, HW_RADIO_POLL_MS);
    return () => {
      cancelledRef.current = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      playerRef.current?.remove();
      playerRef.current = null;
      activeBlockIdRef.current = null;
    };
  }, [station.id]);

  const connect = () => {
    setPlayback('resolving');
    setIsPlaying(false);
    resolveStationStreamCandidates(station.streamQuery ?? station.name).then((candidates) => {
      if (cancelledRef.current) return;
      if (!candidates.length) {
        setPlayback('error');
        return;
      }
      tryCandidate(candidates, 0);
    });
  };

  useEffect(() => {
    if (isStaticDemo) return;
    cancelledRef.current = false;
    connect();
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, [station.id]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setWaveHeights(randomWave()), WAVE_INTERVAL);
    return () => clearInterval(id);
  }, [isPlaying]);

  const togglePlay = () => {
    if (isStaticDemo) {
      const player = playerRef.current;
      if (!player) {
        checkHomeworkRadioSchedule();
        return;
      }
      if (player.playing) player.pause();
      else player.play();
      return;
    }
    if (playback === 'error') {
      connect();
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) player.pause();
    else player.play();
  };

  const isBusy = playback === 'resolving' || playback === 'buffering';

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
        {station.logo ? (
          <View style={styles.cover}>
            <Image source={station.logo} style={styles.coverLogoImg} resizeMode="cover" />
          </View>
        ) : (
          <LinearGradient
            colors={station.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}>
            <Text style={styles.coverFlag}>{station.flag}</Text>
          </LinearGradient>
        )}

        {playback === 'error' ? (
          <View style={[styles.liveBadge, styles.errorBadge]}>
            <Ionicons name="alert-circle" size={14} color={theme.colors.danger} />
            <Text style={styles.liveText}>Ulanib bo'lmadi</Text>
          </View>
        ) : playback === 'silent' ? (
          <View style={[styles.liveBadge, styles.silentBadge]}>
            <Ionicons name="moon-outline" size={14} color={theme.colors.textMuted} />
            <Text style={styles.silentText}>HOZIRCHA JIM</Text>
          </View>
        ) : (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{isBusy ? 'ULANMOQDA...' : 'JONLI EFIR'}</Text>
          </View>
        )}

        <Text style={styles.name}>{station.name}</Text>
        <Text style={styles.genre}>{isStaticDemo && activeBlockTitle ? activeBlockTitle : station.genre}</Text>

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
          style={[styles.playBtn, { backgroundColor: station.colors[1] }, isBusy && styles.playBtnDisabled]}
          disabled={isBusy}
          onPress={togglePlay}>
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name={playback === 'error' ? 'refresh' : isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
          )}
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
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...theme.shadow.card,
  },
  coverLogoImg: { width: '100%', height: '100%' },
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
  errorBadge: { gap: 6 },
  silentBadge: { backgroundColor: theme.colors.surface, gap: 6 },
  silentText: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.textMuted, letterSpacing: 0.5 },
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
  playBtnDisabled: { opacity: 0.7 },

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
