/**
 * Kompyuter: Kitob audiosi — QR trek (dizayn: D_AudioTrack.dc.html), fokus rejim.
 *
 * Ijro mantiqi mobil audiolar/[trackId].tsx'dagi bilan aynan bir xil (u yerdan
 * ko'chirilgan — mobil fayl o'zgarmasligi uchun): expo-audio pleeri, replika
 * vaqtlari (lineStarts / lineTimeline / eventAt), to'xtagan joyni saqlash
 * (AudioList'dagi "davom etmoqda"), oxirigacha tinglansa "eshitilgan".
 * Kitob "qism"i serverda yo'q — "Kitob". Klaviatura: Space ijro/pauza,
 * ← → replikalar, R takrorlash, S tezlik, T tarjima, Enter keyingi trek, Esc yopish.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { allBookTracks, bare, getTrackPositions, parseDur, saveTrackPosition, type BookTrack } from '@/components/v2/library/data';
import { SPEEDS } from '@/components/v2/library/player';
import { eventAt, lineStarts, lineTimeline, markListened, trackLines, useListened, type DialogLine } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';
import { v2Back } from '@/services/v2Nav';

import { FocusFrame, KbdHint } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { DDialogText, DPlayer, IArrow, IChevronLeft, InKbd, IPauseTall, IPlay, IQr, SegProgress, T } from './ui';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function DAudioTrack() {
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
  const next = track ? (all[all.indexOf(track) + 1] ?? null) : null;
  const lines = useMemo(() => (mc && track ? trackLines(mc, track) : []), [mc, track]);

  if (!track) {
    return (
      <FocusFrame closeTo={R.audioList} title="Kitob audiosi">
        <View style={{ padding: 32 }}>
          {loaded && (
            <T w={700} size={15} color="#4A5468">
              Trek topilmadi
            </T>
          )}
        </View>
      </FocusFrame>
    );
  }
  return <TrackView key={track.id} track={track} siblings={siblings} lines={lines} next={next} />;
}

function TrackView({ track, siblings, lines, next }: { track: BookTrack; siblings: BookTrack[]; lines: DialogLine[]; next: BookTrack | null }) {
  const player = useAudioPlayer({ uri: track.url }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeatLine, setRepeatLine] = useState<number | null>(null);
  const [showUz, setShowUz] = useState(true);
  const last = useRef({ t: 0, d: 0 });
  const started = useRef(false);

  const d = status.duration || 0;
  const t = status.currentTime || 0;
  const frac = d > 0 ? Math.min(1, t / d) : 0;
  const n = lines.length;
  const starts = useMemo(() => lineStarts(lines, d), [lines, d]);
  const events = useMemo(() => lineTimeline(lines, starts), [lines, starts]);
  const ev = n && d > 0 && (t > 0 || status.playing) ? eventAt(events, t, track.repeatFrom) : -1;
  const curLine = ev >= 0 ? events[ev].k : -1;
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
  useEffect(
    () => () => {
      if (started.current) void saveTrackPosition(track.id, last.current.t, last.current.d);
    },
    [track.id],
  );
  // Pauzada saqlaymiz — faqat ijro boshlangandan keyin.
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
  const repeat = () => setRepeatLine((r) => (r === null ? Math.max(0, curLine) : null));
  const goNext = () => next && open(next);

  useDesktopKeys({
    ' ': toggle,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
    r: repeat,
    s: cycleSpeed,
    t: () => setShowUz((v) => !v),
    Enter: goNext,
  });

  const dur = track.duration || (d > 0 ? fmt(d) : '');
  const total = d || parseDur(track.duration);
  const L = track.lesson.number;
  const idx = Math.max(0, siblings.indexOf(track));

  return (
    <FocusFrame
      closeTo={R.audioList}
      title="Kitob audiosi"
      subtitle={`Kitob · ${track.no}-trek · ${L}-dars`}
      center={
        <SegProgress
          left={`${L}-dars treklari · ${idx + 1} / ${siblings.length}`}
          right={`${fmt(t)} / ${dur || fmt(total)}`}
          segments={siblings.length}
          current={idx}
          frac={frac}
          label={`${track.no}-trek tinglanmoqda: ${fmt(t)} / ${dur || fmt(total)}`}
        />
      }
      right={
        <View style={s.topChip}>
          <IQr />
          <T size={14} color="#34405A">
            Kitob
          </T>
        </View>
      }
      footerHeight={100}
      footerWidth={1100}
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable accessibilityRole="link" onPress={() => v2Back(R.audioList)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
            <IChevronLeft />
            <T size={15}>Audiolarga qaytish</T>
          </Pressable>
          <View style={{ flex: 1 }} />
          <View accessibilityLabel="Klaviatura" style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <KbdHint keys={['T']} label="tarjima" />
            <KbdHint keys={['S']} label="tezlik" />
          </View>
          {next && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Keyingi trek: ${next.no}-trek (Enter)`}
              onPress={goNext}
              style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              <T size={16} color="#FFFFFF">
                Keyingi trek ·
              </T>
              <T size={16} color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
                «{bare(next.title)}»
              </T>
              <IArrow size={18} color="#FFFFFF" />
              <InKbd>Enter</InKbd>
            </Pressable>
          )}
        </View>
      }
    >
      <View style={s.stage}>
        <View style={s.wrap}>
          <View style={s.left}>
            <View style={s.cover}>
              <Image
                source={track.coverUrl ? { uri: track.coverUrl } : designImages.d9c9d8d26328b24384a9840cf989fb7b}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityLabel={bare(track.title)}
              />
              <View style={s.coverChip}>
                <T size={12} color="#1E3FD1" ls={0.72} style={{ textTransform: 'uppercase' }}>
                  {track.no}-trek{dur ? ` · ${dur}` : ''}
                </T>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T size={30} lh={33} ls={-0.3} accessibilityRole="header">
                «{bare(track.title)}»
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <View style={s.qr}>
                  <IQr size={14} />
                  <T w={700} size={13} color="#4A5468">
                    Kitobdagi QR kod shu trekni ochadi
                  </T>
                </View>
                <T w={700} size={13} color="#4A5468">
                  {n} replika
                </T>
              </View>
            </View>
            <DPlayer
              frac={frac}
              elapsed={t}
              total={total}
              speed={SPEEDS[speedIdx]}
              onSpeed={cycleSpeed}
              playing={status.playing}
              onToggle={toggle}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              repeat={repeatLine !== null}
              onRepeat={repeat}
              unit="replika"
              onSeek={(f) => d > 0 && player.seekTo(f * d)}
              fmt={fmt}
            />
          </View>

          <ScrollView style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
            <DDialogText
              lines={lines}
              current={curLine}
              onLine={(k) => player.seekTo(lineStart(k))}
              empty="Bu trekka matn qoʻshilmagan."
              showUz={showUz}
              onToggleUz={() => setShowUz((v) => !v)}
            />
            <View accessibilityLabel={`${L}-dars treklari`} style={{ gap: 8 }}>
              <View style={s.secHead}>
                <T size={15} accessibilityRole="header">
                  {L}-dars treklari
                </T>
                <T w={700} size={13} color="#4A5468">
                  Kitob
                </T>
              </View>
              {siblings.map((o) => {
                const now = o.id === track.id;
                const od = now ? dur : o.duration || '';
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${o.no}-trek${od ? `, ${od}` : ''}${now ? ' — hozir' : ''}`}
                    accessibilityState={{ selected: now }}
                    onPress={() => open(o)}
                    style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.trow, now && s.trowOn, !now && hovered && { backgroundColor: '#F7F9FF' }]}
                  >
                    <View style={[s.dot, { backgroundColor: now ? '#2F5BFF' : '#E8EEFF' }]}>
                      {now && status.playing ? <IPauseTall size={13} /> : <IPlay size={now ? 13 : 12} color={now ? '#FFFFFF' : '#2F5BFF'} />}
                    </View>
                    <T size={15} lines={1} style={{ flex: 1, minWidth: 0 }}>
                      {bare(o.title)}
                    </T>
                    <T w={700} size={13} color="#4A5468">
                      Kitob · {o.no}-trek
                    </T>
                    {now ? (
                      <T size={13} color="#1E3FD1">
                        hozir
                      </T>
                    ) : (
                      <T w={700} size={13} color="#4A5468" style={{ width: 34, textAlign: 'right' }}>
                        {od}
                      </T>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  topChip: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8 },
  stage: { flex: 1, alignItems: 'center', paddingTop: 26, paddingHorizontal: 16, paddingBottom: 16 },
  wrap: { width: 1100, maxWidth: '100%', flex: 1, flexDirection: 'row', gap: 28 },
  left: { width: 440, flexShrink: 0, gap: 18 },
  cover: { position: 'relative', height: 290, borderRadius: 26, overflow: 'hidden', backgroundColor: '#EAE4DF' },
  coverChip: { position: 'absolute', left: 14, top: 14, height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  qr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6EE',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 4, marginBottom: 2 },
  trow: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trowOn: { backgroundColor: '#E8EEFF', boxShadow: 'inset 0 0 0 2px #2F5BFF' } as object,
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  second: {
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E6EE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cta: {
    height: 54,
    paddingLeft: 26,
    paddingRight: 22,
    borderRadius: 17,
    backgroundColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
});
