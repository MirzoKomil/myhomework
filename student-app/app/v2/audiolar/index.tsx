/**
 * v2 Audiolar (dizayn: 37 AudioList).
 *
 * Treklar — darslikning audio fayllari: CRM'da dars modullariga biriktirilgan
 * audio (dars ichidagi "Audio dialoglar" bilan bir manba, getAudioTracks).
 * Trek raqami — kurs bo'yicha ketma-ket; "eshitilgan" — o'sha audio oxirigacha
 * tinglanganmi (darsdagi bilan umumiy belgi); "davom etmoqda · 0:21" —
 * AudioTrack ekranida to'xtatilgan joy (qurilmada). Davomiylik — modulda
 * kiritilgan bo'lsa. Kitob "qism"i serverda yo'q — "Kitob · 14-trek".
 * QR skaner: ilovada kamera kutubxonasi yo'q → "tez orada" xabari.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allBookTracks, bare, getTrackPositions, groupByLesson, type BookTrack } from '@/components/v2/library/data';
import { lessonMonth } from '@/components/v2/library/grammar';
import { BackButton, CameraIcon, Check, Column, currentLesson, Display, FilterTabs, go, mmss, PlayRounded, T } from '@/components/v2/library/shared';
import { useListened } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';

type Month = 'all' | '1' | '2' | '3';
const TABS: { key: Month; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: '1', label: '1-oy' },
  { key: '2', label: '2-oy' },
  { key: '3', label: '3-oy' },
];

export default function AudioListScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState<Month>('all');
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [cur, setCur] = useState<{ id: string; index: number } | null>(null);
  const [pos, setPos] = useState<Record<string, { t: number; d: number }>>({});
  const [qrNote, setQrNote] = useState(false);
  // Tinglangan treklar saqlagichini yuklaydi va o'zgarganda qayta chizadi.
  const listenedTick = useListened('').length;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const m = await fetchMobileContent();
        const c = await currentLesson(m);
        const p = await getTrackPositions();
        if (!alive) return;
        setMc(m);
        setCur(c ? { id: c.lesson.id, index: c.index } : null);
        setPos(p);
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const groups = useMemo(() => (mc && cur ? groupByLesson(allBookTracks(mc), cur.index) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mc, cur, pos, listenedTick]);
  const shown = month === 'all' ? groups : groups.filter((g) => String(lessonMonth(g.number)) === month);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
      <Column>
        <View style={styles.top}>
          <View style={styles.headRow}>
            <BackButton fallback={R.practice} />
            <Display size={26} lh={1.36} style={{ flex: 1 }}>Audiolar</Display>
          </View>

          <View style={styles.qrCard}>
            <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
              <T w={800} size={15} color="#FFFFFF" lh={1.35}>Kitobdagi QR kodni skanerlang — shu trek ochiladi</T>
              <Pressable accessibilityRole="button" onPress={() => setQrNote(true)} style={({ pressed }) => [styles.qrBtn, pressed && { opacity: 0.85 }]}>
                <CameraIcon />
                <T w={800} size={14} color="#0B1220">QR skanerlash</T>
              </Pressable>
              {qrNote && (
                <T w={700} size={13} color="#B8C1D6" accessibilityLabel="QR skaner tez orada qoʻshiladi">QR skaner tez orada qoʻshiladi — hozircha trekni roʻyxatdan tanlang.</T>
              )}
            </View>
            <View style={styles.qrArt}>
              <Image source={designImages['32eee84d436da97eb104c837c0065230']} style={{ width: 72, height: 72 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            </View>
          </View>

          <FilterTabs
            tabs={TABS}
            value={month}
            onChange={setMonth}
            label="Oy boʻyicha"
            look={{ height: 44, padX: 16, gap: 8, inactiveBorder: '#D5DBE7', inactiveColor: '#4A5468', inactiveWeight: 700 }}
          />
        </View>

        <View style={styles.list}>
          {shown.map((g) => {
            const isToday = g.lesson.id === cur?.id;
            return (
              <View key={g.lesson.id} style={{ gap: 10 }}>
                <View style={styles.secHead}>
                  <T w={800} size={16} accessibilityLabel={isToday ? `${g.number}-dars, bugun` : undefined}>{g.number}-dars</T>
                  {isToday && (
                    <View style={styles.today}>
                      <T w={800} size={12} color="#7A5300">bugun</T>
                    </View>
                  )}
                  <T w={700} size={13} color="#4A5468" style={{ flexShrink: 1 }} numberOfLines={1}>{g.lesson.name}</T>
                </View>
                <View style={styles.card}>
                  {g.tracks.map((t, i) => (
                    <TrackRow key={t.id} t={t} pos={pos[t.id]} last={i === g.tracks.length - 1} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </Column>
    </ScrollView>
  );
}

function TrackRow({ t, pos, last }: { t: BookTrack; pos?: { t: number; d: number }; last: boolean }) {
  // Davom etayotgan trek: to'xtatilgan joy saqlangan va hali oxirigacha eshitilmagan.
  const going = !!pos && !t.heard;
  const dur = t.duration || (pos?.d ? mmss(pos.d) : '');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${bare(t.title)}, ${t.no}-trek${dur ? `, ${dur}` : ''}${t.heard ? ', eshitilgan' : ''}`}
      onPress={() => go(R.audioTrack(t.id))}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.85 }]}
    >
      {going ? (
        <View style={styles.play}>
          <PlayRounded color="#FFFFFF" />
        </View>
      ) : (
        <View style={[styles.num, { backgroundColor: t.heard ? '#E3F7EE' : '#EEF1F7' }]}>
          <T w={800} size={14} color={t.heard ? '#075E3A' : '#4A5468'}>{t.no}</T>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T w={800} size={15}>{bare(t.title)}</T>
        <T w={600} size={12} color="#4A5468" numberOfLines={1}>Kitob · {t.no}-trek</T>
        {going && pos && (
          <View style={styles.progRow}>
            <View style={styles.progTrack}>
              <View style={[styles.progFill, { width: `${pos.d ? Math.min(100, (pos.t / pos.d) * 100) : 0}%` }]} />
            </View>
            <T w={800} size={12} color="#1E3FD1" numberOfLines={1}>davom etmoqda · {mmss(pos.t)}</T>
          </View>
        )}
      </View>
      <View style={styles.right}>
        {!!dur && <T w={800} size={13} color="#4A5468">{dur}</T>}
        {t.heard && (
          <View style={styles.heard}>
            <Check size={12} color="#075E3A" sw={3.4} />
            <T w={800} size={12} color="#075E3A">eshitilgan</T>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  top: { paddingHorizontal: 20, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrCard: { backgroundColor: '#0B1220', borderRadius: 24, paddingVertical: 14, paddingRight: 14, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrBtn: { alignSelf: 'flex-start', height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#FFC93C', flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrArt: { width: 84, height: 84, borderRadius: 20, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  list: { paddingTop: 16, paddingHorizontal: 20, gap: 10 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  today: { backgroundColor: '#FFF4D1', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 7, marginLeft: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  row: { paddingVertical: 10, paddingLeft: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  num: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  progTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E8EEFF', overflow: 'hidden' },
  progFill: { height: 5, borderRadius: 3, backgroundColor: '#2F5BFF' },
  right: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  heard: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
