/**
 * Kompyuter: Dialog — mashqdan (dizayn: D_AudioDialogLib.dc.html), fokus rejim.
 *
 * Ma'lumot va ijro mobil dialoglar/[dialogId].tsx bilan aynan bir xil (u yerdan
 * ko'chirilgan — mobil fayl o'zgarmasligi uchun): CRM speaking mavzusi
 * (replikalar); audioUrl bo'lsa — haqiqiy audio, aks holda expo-speech (ijro —
 * components/v2/library/dialogPlayback), progress qurilmada saqlanadi. Mavzuda bitta dialog —
 * "Mavzudagi dialoglar" ro'yxati bo'sh; "Keyingi dialog" — ro'yxatdagi keyingi mavzu.
 * Klaviatura: Space, ← →, R, S, T, Enter, Esc.
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { dialogCount, getDialogProgress } from '@/components/v2/library/data';
import { hasAudio, topicLines, useAudioDialog, useTtsDialog, type DialogPlayback, type DialogTopic } from '@/components/v2/library/dialogPlayback';
import { SPEEDS } from '@/components/v2/library/player';
import { findLessonForTitle, mmss, type LessonRef } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent } from '@/services/contentApi';
import { v2Back } from '@/services/v2Nav';

import { FocusFrame, KbdHint } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { DDialogText, DPlayer, IArrow, ICheck, IChevronLeft, InKbd, SegProgress, T, type DLine } from './ui';

type Topic = DialogTopic;

export function DDialog() {
  const { dialogId } = useLocalSearchParams<{ dialogId: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [next, setNext] = useState<Topic | null>(null);
  const [lesson, setLesson] = useState<LessonRef | null>(null);
  const [startFrac, setStartFrac] = useState(0);
  const [heard, setHeard] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const mc = await fetchMobileContent();
        const p = await getDialogProgress();
        if (!alive) return;
        const list = mc.library.speaking;
        const i = list.findIndex((x) => x.id === dialogId);
        const t = i >= 0 ? list[i] : null;
        setTopic(t);
        setNext(i >= 0 ? (list[i + 1] ?? null) : null);
        setLesson(t ? findLessonForTitle(mc, t.title) : null);
        setStartFrac(t ? (p[t.id]?.frac ?? 0) : 0);
        setHeard(!!(t && p[t.id]?.heard));
      })()
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, [dialogId]),
  );

  if (!topic) {
    return (
      <FocusFrame closeTo={R.dialogList} closeLabel="Dialoglarga qaytish (Esc)" title="Dialoglar">
        <View style={{ padding: 32 }}>
          {loaded && (
            <T w={700} size={15} color="#4A5468">
              Dialog topilmadi
            </T>
          )}
        </View>
      </FocusFrame>
    );
  }
  return <DialogView key={topic.id} topic={topic} next={next} lesson={lesson} startFrac={startFrac} heard={heard} onHeard={() => setHeard(true)} />;
}

type ViewProps = { topic: Topic; next: Topic | null; lesson: LessonRef | null; startFrac: number; heard: boolean; onHeard: () => void };

function DialogView(props: ViewProps) {
  return hasAudio(props.topic) ? <AudioDialog {...props} /> : <TtsDialog {...props} />;
}
function TtsDialog(props: ViewProps) {
  const lines = useMemo(() => topicLines(props.topic), [props.topic]);
  return <DialogBody {...props} lines={lines} pb={useTtsDialog({ ...props, lines })} />;
}
function AudioDialog(props: ViewProps) {
  const lines = useMemo(() => topicLines(props.topic), [props.topic]);
  return <DialogBody {...props} lines={lines} pb={useAudioDialog({ ...props, lines })} />;
}

function DialogBody({ topic, next, lesson, heard, lines, pb }: ViewProps & { lines: DLine[]; pb: DialogPlayback }) {
  const { line, elapsed, total, frac, playing, speedIdx, repeat, toggle, jump, prev, cycleSpeed, toggleRepeat, seek } = pb;
  const [showUz, setShowUz] = useState(true);
  const n = dialogCount(topic);
  const h = heard ? n : 0;
  const going = !heard && frac > 0;

  const goNext = () => next && router.replace(R.dialog(next.id) as Href);

  useDesktopKeys({
    ' ': toggle,
    ArrowLeft: prev,
    ArrowRight: () => jump(line + 1),
    r: toggleRepeat,
    s: cycleSpeed,
    t: () => setShowUz((v) => !v),
    Enter: goNext,
  });

  return (
    <FocusFrame
      closeTo={R.dialogList}
      closeLabel="Dialoglarga qaytish (Esc)"
      title={`${topic.title} · 1 / ${n}`}
      subtitle={`${h} / ${n} eshitilgan${going ? ' · 1-dialog davomda' : ''}`}
      center={
        <SegProgress
          left={`Dialog 1 / ${n}`}
          right={`${mmss(elapsed)} / ${mmss(total)}`}
          segments={n}
          current={0}
          frac={heard && !going ? 1 : frac}
          label={`Dialog 1 / ${n}, ${mmss(elapsed)} / ${mmss(total)}`}
        />
      }
      right={
        <View style={s.topChip}>
          <T size={14} color="#34405A">
            {h} / {n} eshitilgan
          </T>
        </View>
      }
      footerHeight={100}
      footerWidth={1100}
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable accessibilityRole="link" onPress={() => v2Back(R.dialogList)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
            <IChevronLeft />
            <T size={15}>Dialoglarga qaytish</T>
          </Pressable>
          <View style={{ flex: 1 }} />
          <View accessibilityLabel="Klaviatura" style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <KbdHint keys={['T']} label="tarjima" />
            <KbdHint keys={['S']} label="tezlik" />
          </View>
          {next && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Keyingi dialog: ${next.title} (Enter)`}
              onPress={goNext}
              style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              <T size={16} color="#FFFFFF">
                Keyingi dialog ·
              </T>
              <T size={16} color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
                «{next.title}»
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
            <View style={[s.cover, { backgroundColor: topic.coverUrl ? '#EAE4DF' : (topic.colors?.[0] ?? '#E8EEFF') }]}>
              {topic.coverUrl ? (
                <Image source={{ uri: topic.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={topic.title} />
              ) : (
                <Text style={{ fontSize: 96 }}>{topic.emoji}</Text>
              )}
              <View style={s.coverChip}>
                <T size={12} color="#1E3FD1" ls={0.72} style={{ textTransform: 'uppercase' }}>
                  1-dialog · {mmss(total)}
                </T>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {/* Dialogning alohida nomi CRM'da yo'q — mavzu nomi (mobil bilan bir xil). */}
              <T size={30} lh={33} ls={-0.3} accessibilityRole="header">
                «{topic.title}»
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {lesson && (
                  <View style={s.same}>
                    <ICheck color="#075E3A" sw={2.8} />
                    <T size={13} color="#075E3A">
                      {lesson.number}-dars mavzusi bilan bir xil
                    </T>
                  </View>
                )}
                <T w={700} size={13} color="#4A5468">
                  {lines.length} replika
                </T>
              </View>
            </View>
            <DPlayer
              frac={frac}
              elapsed={elapsed}
              total={total}
              speed={SPEEDS[speedIdx]}
              onSpeed={cycleSpeed}
              playing={playing}
              onToggle={toggle}
              onPrev={prev}
              onNext={() => jump(line + 1)}
              repeat={repeat}
              onRepeat={toggleRepeat}
              unit="replika"
              onSeek={seek}
              disabled={!lines.length}
              fmt={mmss}
            />
          </View>

          <ScrollView style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
            <DDialogText lines={lines} current={line} onLine={jump} empty="Bu dialogga matn qoʻshilmagan." showUz={showUz} onToggleUz={() => setShowUz((v) => !v)} />
            <View accessibilityLabel="Mavzudagi dialoglar" style={{ gap: 8 }}>
              <View style={s.secHead}>
                <T size={15} accessibilityRole="header">
                  Mavzudagi dialoglar
                </T>
                <T w={700} size={13} color="#4A5468">
                  {h} / {n} eshitilgan
                </T>
              </View>
              {/* Mavzuda boshqa dialog yo'q — ro'yxat bo'sh (CRM'da mavzu = bitta dialog). */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  topChip: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F4F6FA', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', paddingTop: 26, paddingHorizontal: 16, paddingBottom: 16 },
  wrap: { width: 1100, maxWidth: '100%', flex: 1, flexDirection: 'row', gap: 28 },
  left: { width: 440, flexShrink: 0, gap: 18 },
  cover: { position: 'relative', height: 290, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverChip: { position: 'absolute', left: 14, top: 14, height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  same: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F7EE', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 4, marginBottom: 2 },
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
