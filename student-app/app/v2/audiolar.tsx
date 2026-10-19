/**
 * v2 Audiolar (dizayn: 33 AudioList).
 *
 * Darslik audio treklari ilovada alohida ma'lumot sifatida yo'q (QR,
 * trek raqami, davomiylik serverda saqlanmaydi). Shu sabab har bir
 * darsning real audio dialoglari — CRM'dagi rolli dialoglar — trek
 * sifatida ko'rsatiladi; bosilganda o'sha darsning audio dialog ekrani
 * ochiladi. Davomiylik va "davom etmoqda" joyi ma'lumoti yo'q — ko'rsatilmaydi.
 * QR skaner: ilovada kamera kutubxonasi yo'q → "tez orada" xabari.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadLessonTracks, type LessonTracks } from '@/components/v2/library/data';
import { lessonMonth } from '@/components/v2/library/grammar';
import { BackButton, CameraIcon, Check, Column, currentLesson, Display, FilterTabs, go, PlayRounded, T } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent } from '@/services/contentApi';

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
  const [groups, setGroups] = useState<LessonTracks[]>([]);
  const [todayId, setTodayId] = useState<string | null>(null);
  const [qrNote, setQrNote] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const mc = await fetchMobileContent();
        const cur = await currentLesson(mc);
        if (!cur) return;
        const g = await loadLessonTracks(mc, cur.index);
        if (!alive) return;
        setTodayId(cur.lesson.id);
        setGroups(g);
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = month === 'all' ? groups : groups.filter((g) => String(lessonMonth(g.number)) === month);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
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
            const isToday = g.lesson.id === todayId;
            const activeIdx = isToday ? g.tracks.findIndex((t) => !t.heard) : -1;
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
                  {g.tracks.map((t, i) => {
                    const active = i === activeIdx;
                    const circle = active ? ['#2F5BFF', '#FFFFFF'] : t.heard ? ['#E3F7EE', '#075E3A'] : ['#E8EEFF', '#1E3FD1'];
                    return (
                      <Pressable
                        key={t.partId}
                        accessibilityRole="link"
                        onPress={() => go(R.audioDialog(g.lesson.id))}
                        style={({ pressed }) => [styles.row, i < g.tracks.length - 1 && styles.rowBorder, pressed && { opacity: 0.85 }]}
                      >
                        <View style={[styles.play, { backgroundColor: circle[0] }]}>
                          <PlayRounded color={circle[1]} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                          <T w={800} size={15}>{t.title}</T>
                          <T w={600} size={12} color="#4A5468">Kitob · {g.number}-dars · {t.trackNo}-trek</T>
                        </View>
                        {t.heard && (
                          <View style={styles.heard}>
                            <Check size={12} color="#075E3A" sw={3.4} />
                            <T w={800} size={11} color="#075E3A">eshitilgan</T>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </Column>
    </ScrollView>
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
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heard: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
});
