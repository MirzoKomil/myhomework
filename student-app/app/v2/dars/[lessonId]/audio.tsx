/**
 * v2 Audio dialoglar (dizayn: 10 AudioDialog).
 *
 * Audio manbasi: CRM'da darsning modullariga biriktirilgan audio fayl
 * havolalari (getAudioTracks). Dialog matni — o'sha moduldagi "Matn"
 * kontenti: "Ism: ruscha gap" qatoridan keyingi qator — tarjimasi.
 * Pleer eski podkast ekranidagi kabi expo-audio bilan ishlaydi.
 * Replikalar vaqti serverda yo'q, shuning uchun joriy replika audio
 * davomiyligini replikalar soniga teng bo'lib taxminlanadi; har replikadan
 * keyin 3 soniya "Endi takrorlang" pauzasi qilinadi.
 * Audio yo'q bo'lsa — dizayndagi joylashuv bo'sh holatda ko'rsatiladi.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtTime, getAudioTracks, markListened, useListened, type AudioTrack } from '@/components/v2/lessons/data';
import { PauseIcon, PlayIcon, QrIcon, RepeatIcon } from '@/components/v2/lessons/icons';
import { Column, HeaderButton } from '@/components/v2/lessons/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';
import { saveLastPosition } from '@/services/progressStore';

type Line = { speaker: string; ru: string; uz: string };

const SPEAKER_COLORS = ['#B34700', '#0B1220', '#1E3FD1', '#087A4A'];
const SPEEDS = [0.75, 1, 1.25];
const PAUSE_MS = 3000;

function parseDialog(text: string): Line[] {
  const out: Line[] = [];
  text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((row) => {
      const m = row.match(/^([^:]{1,24}):\s*(.+)$/);
      if (m) out.push({ speaker: m[1].trim(), ru: m[2].trim(), uz: '' });
      else if (out.length && !out[out.length - 1].uz) out[out.length - 1].uz = row;
    });
  return out;
}

function trackLines(mc: MobileContent, track: AudioTrack): Line[] {
  const content = mc.moduleContents.find((c) => c.id === track.id);
  if (!content) return [];
  const text = mc.moduleContents.find((c) => c.moduleId === content.moduleId && c.type === 'text' && c.text)?.text;
  return text ? parseDialog(text) : [];
}

export default function AudioDialogScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const listened = useListened(id);

  useEffect(() => {
    fetchMobileContent().then(setMc).catch(() => setFailed(true));
    saveLastPosition({ lessonId: id, section: 'audio', label: 'Audio dialoglar' });
  }, [id]);

  const tracks = useMemo(() => (mc ? getAudioTracks(mc, id) : []), [mc, id]);
  const lessonNo = useMemo(() => {
    if (!mc) return 0;
    const l = mc.lessons.find((x) => x.id === id);
    return l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) + 1 : 0;
  }, [mc, id]);
  const track = tracks[trackIdx];
  const lines = useMemo(() => (mc && track ? trackLines(mc, track) : []), [mc, track]);

  const player = useAudioPlayer(track ? { uri: track.url } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [pausedAfter, setPausedAfter] = useState<number | null>(null);
  const lastLine = useRef(-1);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barW, setBarW] = useState(0);

  const duration = status.duration || 0;
  const t = status.currentTime || 0;
  const frac = duration > 0 ? Math.min(1, t / duration) : 0;
  const curLine = lines.length && duration > 0 ? Math.min(lines.length - 1, Math.floor(frac * lines.length)) : -1;

  // Yangi trekka o'tganda holatni tozalaymiz.
  useEffect(() => {
    lastLine.current = -1;
    setPausedAfter(null);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, [trackIdx]);

  useEffect(() => () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, []);

  // Replika tugashi bilan 3 soniya takrorlash pauzasi.
  useEffect(() => {
    if (!status.playing || curLine < 0) return;
    if (lastLine.current >= 0 && curLine > lastLine.current) {
      const done = lastLine.current;
      player.pause();
      setPausedAfter(done);
      pauseTimer.current = setTimeout(() => {
        setPausedAfter(null);
        player.play();
      }, PAUSE_MS);
    }
    lastLine.current = curLine;
  }, [curLine, status.playing, player]);

  useEffect(() => {
    if (status.didJustFinish && track) {
      markListened(id, track.id);
      lastLine.current = -1;
      if (repeat) {
        player.seekTo(0).then(() => player.play());
      }
    }
  }, [status.didJustFinish, track, id, repeat, player]);

  const togglePlay = () => {
    if (!track) return;
    if (pausedAfter !== null) {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      setPausedAfter(null);
      return;
    }
    if (status.playing) player.pause();
    else {
      if (duration > 0 && t >= duration - 0.2) player.seekTo(0);
      player.play();
    }
  };
  const seekBy = (d: number) => {
    if (!track) return;
    lastLine.current = -1;
    player.seekTo(Math.max(0, Math.min(duration || 0, t + d)));
  };
  const cycleSpeed = () => {
    const n = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(n);
    player.setPlaybackRate(SPEEDS[n]);
  };
  const onSeekBar = (x: number) => {
    if (!track || !barW || !duration) return;
    lastLine.current = -1;
    player.seekTo(Math.max(0, Math.min(1, x / barW)) * duration);
  };

  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  const playing = status.playing || pausedAfter !== null;
  const heardCount = listened.filter((x) => tracks.some((tr) => tr.id === x)).length;

  return (
    <View style={styles.screen}>
      <Column>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <HeaderButton kind="close" label="Yopish" fallback={R.lesson(id)} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.headRow}>
              <Text style={styles.headText}>Audio dialoglar</Text>
              <Text style={styles.headText}>Qadam 2 / 5</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Dialog ${tracks.length ? trackIdx + 1 : 0} / ${tracks.length}`}>
              {(tracks.length ? tracks : [null]).map((tr, k) => {
                const isHeard = !!tr && listened.includes(tr.id);
                const fill = k === trackIdx ? frac : isHeard ? 1 : 0;
                return (
                  <View key={k} style={[styles.seg, { backgroundColor: k === trackIdx && tr ? '#D4DEFF' : isHeard ? '#2F5BFF' : '#E2E6EE' }]}>
                    <View style={{ width: `${fill * 100}%`, height: 8, backgroundColor: '#2F5BFF' }} />
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Image
              source={track?.coverUrl ? { uri: track.coverUrl } : designImages.b3fe02724ceeae9be8b9aec48cfff965}
              style={styles.cover}
              resizeMode="cover"
              accessibilityLabel="Dialog sahnasi"
            />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={styles.overline}>Audio dialog {tracks.length ? trackIdx + 1 : 0} / {tracks.length}</Text>
              <Text accessibilityRole="header" style={styles.h1}>
                {track ? track.title : failed ? 'Yuklab boʻlmadi' : mc ? 'Audio hali qoʻshilmagan' : 'Yuklanmoqda…'}
              </Text>
              <View style={styles.qr}>
                <QrIcon />
                <Text style={styles.qrText}>Kitob · {lessonNo || '—'}-dars · {tracks.length ? trackIdx + 1 : 0}-trek · QR</Text>
              </View>
            </View>
          </View>

          <View accessibilityLabel="Pleer" style={styles.player}>
            <View style={{ gap: 5 }}>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Ijro joyi"
                onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}
                onPress={(e) => onSeekBar(e.nativeEvent.locationX)}
                style={{ paddingVertical: 5, marginVertical: -5 }}
              >
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${frac * 100}%` }]} />
                  <View style={[styles.knob, { left: `${frac * 100}%` }]} />
                </View>
              </Pressable>
              <View style={styles.times}>
                <Text style={styles.time}>{fmtTime(t)}</Text>
                <Text style={styles.time}>{track?.duration && !duration ? track.duration : fmtTime(duration)}</Text>
              </View>
            </View>
            <View style={styles.controls}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${SPEEDS[speedIdx]}x (0.75 / 1 / 1.25)`} onPress={cycleSpeed} style={styles.speed}>
                <Text style={styles.speedTop}>{SPEEDS[speedIdx]}×</Text>
                <Text style={styles.speedSub}>tezlik</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="5 soniya orqaga" onPress={() => seekBy(-5)} style={styles.round}>
                <Text style={styles.roundText}>−5s</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pauza' : 'Ijro etish'}
                disabled={!track}
                onPress={togglePlay}
                style={[styles.play, !track && { opacity: 0.5 }]}
              >
                {playing ? <PauseIcon /> : <PlayIcon size={26} color="#FFFFFF" />}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="5 soniya oldinga" onPress={() => seekBy(5)} style={styles.round}>
                <Text style={styles.roundText}>+5s</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Takrorlash rejimi"
                accessibilityState={{ selected: repeat }}
                onPress={() => setRepeat((r) => !r)}
                style={[styles.speed, repeat && { backgroundColor: '#2F5BFF' }]}
              >
                <RepeatIcon />
              </Pressable>
            </View>
          </View>

          <View accessibilityLabel="Matn" style={styles.text}>
            {lines.length === 0 ? (
              <View style={styles.line}>
                <Text style={[styles.uz, { paddingVertical: 4 }]}>
                  {track ? 'Bu dialogga matn qoʻshilmagan.' : 'Bu darsga hali audio dialog qoʻshilmagan.'}
                </Text>
              </View>
            ) : (
              lines.map((l, k) => {
                const isCur = k === curLine && pausedAfter === null;
                const color = SPEAKER_COLORS[speakers.indexOf(l.speaker) % SPEAKER_COLORS.length];
                const future = curLine >= 0 && k > curLine;
                return (
                  <View key={k}>
                    <View style={[styles.line, isCur && styles.lineCur]}>
                      <View style={[styles.avatar, { backgroundColor: color }]} accessibilityLabel={l.speaker}>
                        <Text style={styles.avatarText}>{l.speaker.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <Text style={[styles.ru, isCur && { fontFamily: fonts.bodyHeavy }, future && { color: '#4A5468' }]}>{l.ru}</Text>
                        {!!l.uz && <Text style={styles.uz}>{l.uz}</Text>}
                      </View>
                    </View>
                    {pausedAfter === k && (
                      <View accessibilityRole="alert" style={styles.repeatBox}>
                        <PauseIcon size={16} color="#7A5300" />
                        <Text style={styles.repeatText}>Endi takrorlang</Text>
                        <Text style={styles.repeatSub}>pauza 3 s</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {tracks.length > 1 && (
            <>
              <Text style={styles.nextLabel}>Keyingi dialoglar</Text>
              <View accessibilityLabel="Keyingi dialoglar" style={styles.grid}>
                {tracks
                  .map((tr, k) => ({ tr, k }))
                  .filter(({ k }) => k !== trackIdx)
                  .map(({ tr, k }) => (
                    <Pressable
                      key={tr.id}
                      accessibilityRole="link"
                      onPress={() => {
                        player.pause();
                        setTrackIdx(k);
                      }}
                      style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.nextMeta}>{k + 1}{tr.duration ? ` · ${tr.duration}` : ''}{listened.includes(tr.id) ? ' · tinglandi' : ''}</Text>
                      <Text style={styles.nextTitle}>{tr.title}</Text>
                    </Pressable>
                  ))}
              </View>
            </>
          )}
          {tracks.length > 0 && heardCount === tracks.length && (
            <Pressable accessibilityRole="link" onPress={() => router.replace(R.lesson(id) as Href)} style={({ pressed }) => [styles.nextCard, { alignItems: 'center' }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.nextTitle}>Darsga qaytish</Text>
            </Pressable>
          )}
        </ScrollView>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  seg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  content: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 92, height: 92, borderRadius: 20 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#1E3FD1', fontWeight: 'normal' },
  h1: { fontFamily: fonts.bodyHeavy, fontSize: 23, lineHeight: 25.3, letterSpacing: -0.23, color: '#0B1220', fontWeight: 'normal' },
  qr: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8 },
  qrText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  player: { backgroundColor: '#0B1220', borderRadius: 22, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  bar: { position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF' },
  knob: { position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#B8C1D6', fontVariant: ['tabular-nums'], fontWeight: 'normal' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speed: { height: 44, minWidth: 56, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  speedTop: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 15, color: '#FFFFFF', fontWeight: 'normal' },
  speedSub: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 11, color: '#B8C1D6', fontWeight: 'normal' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  roundText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#FFFFFF', fontWeight: 'normal' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  text: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 8, gap: 2 },
  line: { borderRadius: 14, paddingVertical: 7, paddingRight: 10, paddingLeft: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  lineCur: { backgroundColor: '#E8EEFF', boxShadow: 'inset 4px 0 0 #2F5BFF' } as object,
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  avatarText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#FFFFFF', fontWeight: 'normal' },
  ru: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  uz: { fontFamily: fonts.body, fontSize: 13, lineHeight: 16.9, color: '#4A5468', fontWeight: 'normal' },
  repeatBox: { marginVertical: 2, marginHorizontal: 4, height: 44, borderRadius: 12, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  repeatText: { flex: 1, fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#7A5300', fontWeight: 'normal' },
  repeatSub: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#7A5300', fontWeight: 'normal' },
  nextLabel: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', textTransform: 'uppercase', letterSpacing: 0.78, marginBottom: -4, fontWeight: 'normal' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nextCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, gap: 2, minHeight: 44 },
  nextMeta: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  nextTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
});
