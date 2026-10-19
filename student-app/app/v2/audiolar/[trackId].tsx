/**
 * v2 Kitob audiosi — QR trek (dizayn: 76 AudioTrack).
 *
 * Trek — CRM audio dialogi yoki dars moduliga biriktirilgan audio fayl
 * (AudioList va darsdagi audio dialog bilan bir manba — getAudioTracks).
 * Matn — trackLines (darsdagi bilan bir xil). Replika vaqtlari (start)
 * berilgan bo'lsa joriy replika shular bo'yicha, aks holda audio
 * davomiyligi replikalar soniga teng bo'lib taxminlanadi. To'xtatilgan joy qurilmada saqlanadi (AudioList'dagi
 * "davom etmoqda"), oxirigacha tinglansa — "eshitilgan" (darsdagi bilan umumiy).
 * Rasm — modulga rasm biriktirilgan bo'lsa o'sha, bo'lmasa dizayndagi sahna.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allBookTracks, bare, getTrackPositions, parseDur, saveTrackPosition, type BookTrack } from '@/components/v2/library/data';
import { DarkPlayer, DialogText, SPEEDS, type DLine } from '@/components/v2/library/player';
import { ChevronLeftWide, Column, Display, goBack, PauseTall, PlaySmall, QrIcon, T } from '@/components/v2/library/shared';
import { lineAt, lineStarts, markListened, trackLines, useListened } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';

export default function AudioTrackScreen() {
  const insets = useSafeAreaInsets();
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const id = String(trackId);
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const tick = useListened('').length;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMobileContent()
        .then((m) => alive && setMc(m))
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, []),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => (mc ? allBookTracks(mc) : []), [mc, tick]);
  const track = all.find((t) => t.id === id) ?? null;
  const siblings = track ? all.filter((t) => t.lesson.lesson.id === track.lesson.lesson.id) : [];
  const lines = useMemo(() => (mc && track ? trackLines(mc, track) : []), [mc, track]);

  if (!track) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={{ paddingHorizontal: 20, gap: 16 }}>
          <BackBtn />
          {loaded && <T w={700} size={15} color="#4A5468">Trek topilmadi</T>}
        </Column>
      </View>
    );
  }
  return <TrackView key={track.id} track={track} siblings={siblings} lines={lines} />;
}

function BackBtn() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Audiolarga qaytish" onPress={() => goBack(R.audioList)} style={({ pressed }) => [styles.back, pressed && { opacity: 0.85 }]}>
      <ChevronLeftWide />
    </Pressable>
  );
}

function TrackView({ track, siblings, lines }: { track: BookTrack; siblings: BookTrack[]; lines: DLine[] }) {
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer({ uri: track.url }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeatLine, setRepeatLine] = useState<number | null>(null);
  const last = useRef({ t: 0, d: 0 });
  const started = useRef(false);

  const d = status.duration || 0;
  const t = status.currentTime || 0;
  const frac = d > 0 ? Math.min(1, t / d) : 0;
  const n = lines.length;
  // Hali boshlanmagan bo'lsa replika belgilanmaydi.
  const starts = useMemo(() => lineStarts(lines, d), [lines, d]);
  const curLine = n && d > 0 && (t > 0 || status.playing) ? lineAt(starts, t) : -1;
  const lineStart = (k: number) => (d > 0 && n ? (starts[Math.max(0, Math.min(n - 1, k))] ?? 0) : 0);
  last.current = { t, d };

  // Avval to'xtatilgan joydan davom ettiramiz (AudioList'dagi "davom etmoqda").
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !status.isLoaded || d <= 0) return;
    resumed.current = true;
    getTrackPositions().then((p) => {
      const at = p[track.id]?.t ?? 0;
      if (at > 0 && at < d - 0.5) player.seekTo(at);
    });
  }, [status.isLoaded, d, track.id, player]);

  // Ekrandan chiqishda to'xtagan joyni saqlaymiz.
  useEffect(() => () => {
    if (started.current) void saveTrackPosition(track.id, last.current.t, last.current.d);
  }, [track.id]);
  // Pauzada saqlaymiz — faqat ijro boshlangandan keyin (aks holda saqlangan joy o'chib ketadi).
  useEffect(() => {
    if (status.playing) started.current = true;
    else if (started.current && d > 0) void saveTrackPosition(track.id, t, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.playing]);

  useEffect(() => {
    if (status.didJustFinish) {
      void markListened(track.lesson.lesson.id, track.id);
      void saveTrackPosition(track.id, 0, d);
    }
  }, [status.didJustFinish, track, d]);

  // Replikani takrorlash: tanlangan replika tugashi bilan boshiga qaytamiz.
  useEffect(() => {
    if (repeatLine === null || !status.playing || curLine < 0) return;
    if (curLine !== repeatLine) player.seekTo(lineStart(repeatLine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curLine, repeatLine, status.playing]);

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (d > 0 && t >= d - 0.2) player.seekTo(0);
      player.play();
    }
  };
  const step = (dir: -1 | 1) => {
    if (!n || d <= 0) {
      player.seekTo(Math.max(0, Math.min(d, t + dir * 5)));
      return;
    }
    const base = curLine < 0 ? 0 : curLine;
    // Replika boshidan 1 s o'tgan bo'lsa "oldingi" — shu replika boshiga.
    const target = dir < 0 ? (t - lineStart(base) > 1 ? base : Math.max(0, base - 1)) : Math.min(n - 1, base + 1);
    if (repeatLine !== null) setRepeatLine(target);
    player.seekTo(lineStart(target));
  };
  const cycleSpeed = () => {
    const k = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(k);
    player.setPlaybackRate(SPEEDS[k]);
  };
  const open = (other: BookTrack) => {
    if (other.id === track.id) return toggle();
    player.pause();
    router.replace(R.audioTrack(other.id) as Href);
  };

  const dur = track.duration || (d > 0 ? fmt(d) : '');
  const L = track.lesson.number;

  return (
    <View style={styles.root}>
      <Column style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <BackBtn />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Display size={24} lh={1.1}>Kitob audiosi</Display>
            <T w={700} size={13} color="#4A5468" numberOfLines={1}>Kitob · {track.no}-trek · {L}-dars</T>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Image
              source={track.coverUrl ? { uri: track.coverUrl } : designImages.d9c9d8d26328b24384a9840cf989fb7b}
              style={styles.cover}
              resizeMode="cover"
              accessibilityLabel={bare(track.title)}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T w={800} size={12} color="#1E3FD1" style={styles.upper}>{track.no}-trek{dur ? ` · ${dur}` : ''}</T>
              <T w={800} size={23} lh={1.1} style={{ letterSpacing: -0.23 }}>«{bare(track.title)}»</T>
              <View style={styles.qr}>
                <QrIcon />
                <T w={700} size={12} color="#4A5468">Kitobdagi QR kod shu trekni ochadi</T>
              </View>
            </View>
          </View>

          <DarkPlayer
            frac={frac}
            elapsed={t}
            total={d || parseDur(track.duration)}
            speed={SPEEDS[speedIdx]}
            onSpeed={cycleSpeed}
            playing={status.playing}
            onToggle={toggle}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            repeat={repeatLine !== null}
            onRepeat={() => setRepeatLine((r) => (r === null ? Math.max(0, curLine) : null))}
            unit="replika"
            onSeek={(f) => d > 0 && player.seekTo(f * d)}
          />

          <DialogText lines={lines} current={curLine} onLine={(k) => player.seekTo(lineStart(k))} empty="Bu trekka matn qoʻshilmagan." />

          <View style={styles.secHead}>
            <T w={800} size={13} color="#4A5468" style={styles.upperH2}>{L}-dars treklari</T>
            <T w={800} size={12} color="#4A5468">Kitob</T>
          </View>
          <View accessibilityLabel={`${L}-dars treklari`} style={styles.list}>
            {siblings.map((o, i) => {
              const now = o.id === track.id;
              const od = now ? dur : o.duration || '';
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.no}-trek${od ? `, ${od}` : ''}`}
                  onPress={() => open(o)}
                  style={({ pressed }) => [styles.row, i < siblings.length - 1 && styles.rowBorder, now && styles.rowNow, pressed && { opacity: 0.85 }]}
                >
                  <View style={[styles.dot, { backgroundColor: now ? '#2F5BFF' : '#E8EEFF' }]}>
                    {now ? (status.playing ? <PauseTall size={16} /> : <PlaySmall color="#FFFFFF" />) : <PlaySmall />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <T w={800} size={15}>{bare(o.title)}</T>
                    <T w={700} size={12} color="#4A5468">Kitob · {o.no}-trek</T>
                  </View>
                  {now ? <T w={800} size={12} color="#1E3FD1">hozir</T> : !!od && <T w={800} size={13} color="#4A5468">{od}</T>}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Column>
    </View>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { paddingTop: 14, paddingHorizontal: 20, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 72, height: 72, borderRadius: 20, flexShrink: 0 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.72 },
  upperH2: { textTransform: 'uppercase', letterSpacing: 0.78 }, // 13px × 0.06em
  qr: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -4 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 6 },
  row: { minHeight: 52, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowNow: { backgroundColor: '#E8EEFF' },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
