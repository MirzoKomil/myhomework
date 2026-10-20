/**
 * Kompyuter: Audiolar (dizayn: D_AudioList.dc.html).
 *
 * Ma'lumot mobil ekran bilan aynan bir xil: darslik treklari (allBookTracks →
 * groupByLesson, joriy darsdan orqaga), "eshitilgan" (darsdagi bilan umumiy
 * belgi), "davom etmoqda · 0:21" (AudioTrack'da to'xtatilgan joy). Kitob
 * "qism"i serverda yo'q — "Kitob · 14-trek" (mobil bilan bir xil). O'ngdagi
 * "Kitob" kartasi — ro'yxatdagi darslarning trek oralig'i (dizayndagidek 3 ta).
 * QR tugmasi (kamera kutubxonasi yo'q) mobil kabi davom etayotgan trekni ochadi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { allBookTracks, bare, getTrackPositions, groupByLesson, type BookTrack } from '@/components/v2/library/data';
import { lessonMonth } from '@/components/v2/library/grammar';
import { currentLesson, go, mmss } from '@/components/v2/library/shared';
import { useListened } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';

import { DesktopPage } from '../Shell';
import { DTabs, ICamera, ICheck, IPlay, Over, T } from './ui';

type Month = 'all' | '1' | '2' | '3';
const TABS: { key: Month; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: '1', label: '1-oy' },
  { key: '2', label: '2-oy' },
  { key: '3', label: '3-oy' },
];

export function DAudioList() {
  const [month, setMonth] = useState<Month>('all');
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [cur, setCur] = useState<{ id: string; index: number } | null>(null);
  const [pos, setPos] = useState<Record<string, { t: number; d: number }>>({});
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

  const groups = useMemo(
    () => (mc && cur ? groupByLesson(allBookTracks(mc), cur.index) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mc, cur, pos, listenedTick],
  );
  const allTracks = groups.flatMap((g) => g.tracks);
  const qrTarget = allTracks.find((t) => pos[t.id] && !t.heard)?.id ?? groups.find((g) => g.lesson.id === cur?.id)?.tracks[0]?.id ?? allTracks[0]?.id ?? null;
  const shown = month === 'all' ? groups : groups.filter((g) => String(lessonMonth(g.number)) === month);

  return (
    <DesktopPage title="Audiolar" subtitle="Darslikdagi audio treklar · kitob tartibida" back={R.practice} scroll={false} contentStyle={{ paddingBottom: 32 }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 1, minWidth: 420, gap: 10 }}>
          <DTabs tabs={TABS} value={month} onChange={setMonth} label="Oy boʻyicha" />
          <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {shown.map((g, gi) => {
              const isToday = g.lesson.id === cur?.id;
              return (
                <View key={g.lesson.id} style={{ gap: 10, marginTop: gi ? 14 : 0 }}>
                  <View style={s.secHead}>
                    <T size={18} accessibilityLabel={isToday ? `${g.number}-dars, bugun` : undefined}>
                      {g.number}-dars
                    </T>
                    {isToday && (
                      <View style={s.today}>
                        <T size={13} color="#7A5300">
                          bugun
                        </T>
                      </View>
                    )}
                    <T w={700} size={14} color="#4A5468" lines={1} style={{ flexShrink: 1 }}>
                      {g.lesson.name}
                    </T>
                  </View>
                  <View style={s.card}>
                    {g.tracks.map((t, i) => (
                      <TrackRow key={t.id} t={t} pos={pos[t.id]} first={i === 0} last={i === g.tracks.length - 1} />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ width: 320, flexShrink: 1, minWidth: 240, gap: 16 }}>
          <View style={s.qr}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.qrArt}>
              <View style={[s.corner, { left: 18, top: 18, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 8 }]} />
              <View style={[s.corner, { right: 18, top: 18, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 8 }]} />
              <View style={[s.corner, { left: 18, bottom: 18, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 8 }]} />
              <View style={[s.corner, { right: 18, bottom: 18, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 8 }]} />
              <Image source={designImages['32eee84d436da97eb104c837c0065230']} style={{ width: 150, height: 150 }} resizeMode="contain" />
            </View>
            <T size={21} lh={27.3} color="#FFFFFF">
              Kitobdagi QR kodni skanerlang — shu trek ochiladi
            </T>
            <Pressable
              accessibilityRole="link"
              disabled={!qrTarget}
              onPress={() => qrTarget && go(R.audioTrack(qrTarget))}
              style={({ pressed }) => [s.qrBtn, pressed && { opacity: 0.85 }]}
            >
              <ICamera />
              <T size={16}>QR skanerlash</T>
            </Pressable>
            <T w={700} size={13} color="#B8C1D6" style={{ textAlign: 'center' }}>
              Kompyuter kamerasi orqali
            </T>
          </View>
          {shown.length > 0 && (
            <View style={s.book}>
              <Over color="#4A5468">Kitob</Over>
              {shown.slice(0, 3).map((g) => {
                const a = g.tracks[0]?.no;
                const b = g.tracks[g.tracks.length - 1]?.no;
                return (
                  <View key={g.lesson.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T w={700} size={14} color="#4A5468">
                      {g.number}-dars
                    </T>
                    <T size={14}>{a === b ? `${a}-trek` : `${a}–${b}-trek`}</T>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </DesktopPage>
  );
}

function TrackRow({ t, pos, first, last }: { t: BookTrack; pos?: { t: number; d: number }; first: boolean; last: boolean }) {
  const going = !!pos && !t.heard;
  const dur = t.duration || (pos?.d ? mmss(pos.d) : '');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${bare(t.title)}, ${t.no}-trek${dur ? `, ${dur}` : ''}${t.heard ? ', eshitilgan' : ''}`}
      onPress={() => go(R.audioTrack(t.id))}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
        s.row,
        !last && s.rowBorder,
        going && { height: 66, backgroundColor: '#F7F9FF' },
        going && first && { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
        !going && hovered && { backgroundColor: '#F7F9FF' },
      ]}
    >
      {going ? (
        <View style={s.play}>
          <IPlay />
        </View>
      ) : (
        <View style={[s.num, { backgroundColor: t.heard ? '#E3F7EE' : '#EEF1F7' }]}>
          <T size={15} color={t.heard ? '#075E3A' : '#34405A'}>
            {t.no}
          </T>
        </View>
      )}
      <T size={16} lines={1} style={{ flex: 1, minWidth: 140 }}>
        {bare(t.title)}
      </T>
      <T w={700} size={13} color="#4A5468" lines={1} style={{ width: 160, flexShrink: 1 }}>
        Kitob · {t.no}-trek
      </T>
      {going && pos ? (
        <View style={{ width: 150, alignItems: 'flex-end', gap: 5 }}>
          <T size={13} color="#1E3FD1" lines={1}>
            davom etmoqda · {mmss(pos.t)}
          </T>
          <View style={s.progTrack}>
            <View style={[s.progFill, { width: `${pos.d ? Math.min(100, (pos.t / pos.d) * 100) : 0}%` }]} />
          </View>
        </View>
      ) : t.heard ? (
        <View style={s.heard}>
          <ICheck color="#075E3A" sw={2.8} />
          <T size={13} color="#075E3A">
            eshitilgan
          </T>
        </View>
      ) : (
        <View style={{ width: 150 }} />
      )}
      <T size={15} style={{ width: 40, textAlign: 'right' }}>
        {dur}
      </T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  today: { height: 24, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#FFF4D1', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { height: 58, paddingLeft: 14, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  num: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  progTrack: { width: 140, height: 5, borderRadius: 3, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  progFill: { height: 5, borderRadius: 3, backgroundColor: '#2F5BFF' },
  heard: { width: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  qr: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0B1220', borderRadius: 26, padding: 24, gap: 16 },
  qrArt: { position: 'relative', flex: 1, minHeight: 150, borderRadius: 22, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#FFC93C' },
  qrBtn: { height: 52, borderRadius: 16, backgroundColor: '#FFC93C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  book: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, gap: 12 },
});
