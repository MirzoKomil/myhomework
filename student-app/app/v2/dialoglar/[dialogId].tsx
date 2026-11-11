/**
 * v2 Dialog — mashqdan (dizayn: 41 AudioDialogLib).
 *
 * Dialog — CRM kutubxonasidagi speaking mavzusi (mc.library.speaking):
 * replikalar (speaker, ruscha gap, tarjima). Mavzuga audioUrl biriktirilgan
 * bo'lsa — ikki ovozli haqiqiy audio (replika vaqtlari lines[].start), aks holda
 * eski resources/speaking ekranidagi kabi expo-speech, vaqt matndan taxminiy
 * (ijro — components/v2/library/dialogPlayback). Mavzuda bitta dialog bor,
 * shuning uchun "1 / 1" va "Mavzudagi dialoglar" ro'yxati bo'sh bo'ladi.
 * "32-dars mavzusi bilan bir xil" — mavzu nomi dars nomiga mos kelsa.
 * Progress (qayergacha / eshitilgan) qurilmada saqlanadi — DialogList'da ko'rinadi.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dialogCount, getDialogProgress } from '@/components/v2/library/data';
import { hasAudio, topicLines, useAudioDialog, useTtsDialog, type DialogPlayback, type DialogTopic } from '@/components/v2/library/dialogPlayback';
import { DarkPlayer, DialogText, SPEEDS, type DLine } from '@/components/v2/library/player';
import { ChevronLeftWide, Column, Display, findLessonForTitle, goBack, mmss, T, type LessonRef } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent } from '@/services/contentApi';
import { DDialog } from '@/components/v2/desktop/library/DDialog';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Topic = DialogTopic;

// Kompyuterda (keng oyna) — dizayndagi D_ versiya; telefonda mobil ekran o'zgarmaydi.
export default function DialogScreen() {
  return useIsDesktop() ? <DDialog /> : <DialogScreenMobile />;
}

function DialogScreenMobile() {
  const insets = useSafeAreaInsets();
  const { dialogId } = useLocalSearchParams<{ dialogId: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
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
        const t = mc.library.speaking.find((x) => x.id === dialogId) ?? null;
        setTopic(t);
        setLesson(t ? findLessonForTitle(mc, t.title) : null);
        setStartFrac(t ? p[t.id]?.frac ?? 0 : 0);
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
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={{ paddingHorizontal: 20, gap: 16 }}>
          <BackBtn />
          {loaded && <T w={700} size={15} color="#4A5468">Dialog topilmadi</T>}
        </Column>
      </View>
    );
  }
  return <DialogView key={topic.id} topic={topic} lesson={lesson} startFrac={startFrac} heard={heard} onHeard={() => setHeard(true)} />;
}

function BackBtn() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dialoglarga qaytish" onPress={() => goBack(R.dialogList)} style={({ pressed }) => [styles.back, pressed && { opacity: 0.85 }]}>
      <ChevronLeftWide />
    </Pressable>
  );
}

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

type ViewProps = { topic: Topic; lesson: LessonRef | null; startFrac: number; heard: boolean; onHeard: () => void };

function DialogBody({ topic, lesson, heard, lines, pb }: ViewProps & { lines: DLine[]; pb: DialogPlayback }) {
  const insets = useSafeAreaInsets();
  const { line, elapsed, total, frac, playing, speedIdx, repeat, toggle, jump, prev, cycleSpeed, toggleRepeat, seek } = pb;
  const n = dialogCount(topic);
  const h = heard ? n : 0;
  const going = !heard && frac > 0;

  return (
    <View style={styles.root}>
      <Column style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <BackBtn />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Display size={24} lh={1.1}>
              {topic.title} <Text style={{ color: '#5B6478' }}>· 1 / {n}</Text>
            </Display>
            <T w={700} size={13} color="#4A5468" numberOfLines={1}>{h} / {n} eshitilgan{going ? ' · 1-dialog davomda' : ''}</T>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <View style={[styles.cover, { backgroundColor: topic.colors?.[0] ?? '#E8EEFF' }]}>
              {topic.coverUrl ? (
                <Image source={{ uri: topic.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={topic.title} />
              ) : (
                <Text style={{ fontSize: 36 }}>{topic.emoji}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T w={800} size={12} color="#1E3FD1" style={styles.upper}>1-dialog · {mmss(total)}</T>
              {/* Dialogning alohida nomi CRM'da yo'q — mavzu nomi. */}
              <T w={800} size={23} lh={1.1} style={{ letterSpacing: -0.23 }}>«{topic.title}»</T>
              {lesson && (
                <View style={styles.same}>
                  <T w={800} size={12} color="#075E3A">{lesson.number}-dars mavzusi bilan bir xil</T>
                </View>
              )}
            </View>
          </View>

          <DarkPlayer
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
          />

          <DialogText lines={lines} current={line} onLine={jump} empty="Bu dialogga matn qoʻshilmagan." />

          <View style={styles.secHead}>
            <T w={800} size={13} color="#4A5468" style={styles.upperH2}>Mavzudagi dialoglar</T>
            <T w={800} size={12} color="#4A5468">{h} / {n} eshitilgan</T>
          </View>
          {/* Mavzuda boshqa dialog yo'q — ro'yxat bo'sh (CRM'da mavzu = bitta dialog). */}
          <View accessibilityLabel="Mavzudagi dialoglar" style={styles.grid} />
        </ScrollView>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { paddingTop: 14, paddingHorizontal: 20, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 72, height: 72, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.72 },
  upperH2: { textTransform: 'uppercase', letterSpacing: 0.78 }, // 13px × 0.06em
  same: { alignSelf: 'flex-start', backgroundColor: '#E3F7EE', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
