/**
 * v2 Oflayn darslar (dizayn: 60 Offline).
 *
 * Ilovada darslarni yuklab olish (oflayn saqlash) funksiyasi hozircha
 * YO'Q. Shu sabab ro'yxatda joriy darsning real materiallari (so'zlar,
 * audio dialoglar, videodars) ko'rsatiladi, lekin hammasi "yuklanmagan"
 * holatda va jami hajm 0 MB. Internet holati — webda navigator.onLine
 * (native'da tarmoq kutubxonasi yo'q → doim "bor" deb hisoblanadi).
 * Audio dialoglar — darsga biriktirilgan audio fayllar soni va modullarda
 * kiritilgan davomiylik yig'indisi. Videodars davomiyligi serverda yo'q.
 * "Telefon xotirasi": qurilma xotirasini o'qiydigan kutubxona yo'q —
 * Domwork 0 MB, boshqa ilovalar va bo'sh joy bo'sh (o'lchovsiz) holatda.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Column, currentLesson, Display, go, latestVideoLesson, LiveIcon, mmss, NoWifiIcon, pad2, SavedIcon, T } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { parseDur } from '@/components/v2/library/data';
import { getAudioTracks } from '@/components/v2/lessons/data';
import { getResolvedLessonContent } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchMobileContent, invalidateCache } from '@/services/contentApi';
import { DOffline } from '@/components/v2/desktop/profile/DOffline';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Item = { key: string; title: string; sub: string; bg: string; img: keyof typeof designImages; href: string };

function isOnline() {
  return Platform.OS !== 'web' || typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function liveLabel(d: Date) {
  const now = new Date();
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `bugun ${time}` : time;
}

export default function OfflineScreen() {
  return useIsDesktop() ? <DOffline /> : <OfflineScreenMobile />;
}

function OfflineScreenMobile() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(isOnline);
  const [items, setItems] = useState<Item[]>([]);
  const [live, setLive] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    (async () => {
      const mc = await fetchMobileContent();
      const cur = await currentLesson(mc);
      const out: Item[] = [];
      if (cur) {
        const c = await getResolvedLessonContent(cur.lesson.id, cur.index);
        const tracks = getAudioTracks(mc, cur.lesson.id);
        const secs = tracks.reduce((a, t) => a + parseDur(t.duration), 0);
        out.push({ key: 'vocab', title: `${cur.number}-dars · soʻzlar`, sub: `${c.vocabulary.length} soʻz · talaffuz audiosi`, bg: '#FFF4D1', img: 'fbb02b72ab2658bf66887f19d3df5d58', href: R.wordList(cur.lesson.id) });
        out.push({ key: 'audio', title: `${cur.number}-dars · audio dialoglar`, sub: `${tracks.length} ta dialog${secs ? ` · ${mmss(secs)}` : ''}`, bg: '#FDECEC', img: '32eee84d436da97eb104c837c0065230', href: R.audioDialog(cur.lesson.id) });
      }
      const vid = latestVideoLesson(mc, cur);
      if (vid) {
        out.push({ key: 'video', title: `${vid.number}-dars · videodars`, sub: vid.lesson.name, bg: '#E3F7EE', img: 'f639c30e1400761df83230b833ba42b2', href: R.video(vid.lesson.id) });
      }
      if (alive) setItems(out);
    })().catch(() => {});
    fetchDemoSchedule()
      .then((s) => alive && setLive(s.startsAt ? liveLabel(new Date(s.startsAt)) : s.lessonTime || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const retry = () => {
    setOnline(isOnline());
    invalidateCache();
    load();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
      <Column>
        <View style={styles.header}>
          <BackButton fallback={R.settings} />
          <Display size={24} lh={1.36}>Oflayn darslar</Display>
        </View>

        {/* Dizayndagi "Internet yoʻq" chipi faqat oflayn paytda ko'rinadi. */}
        {!online && (
          <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={styles.status}>
            <NoWifiIcon />
            <T w={700} size={14} color="#FFFFFF" style={{ flex: 1, minWidth: 0 }}>Internet yoʻq</T>
            <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.85 }]}>
              <T w={800} size={13} color="#FFFFFF">Qayta urinish</T>
            </Pressable>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.hero}>
            <Image source={designImages['78f533d49645c292f499fbc1b6168dd2']} style={{ width: 130, height: 124 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <Display size={24} ls={-0.01} lh={1.2} style={{ textAlign: 'center' }}>Oflayn ham oʻqish mumkin</Display>
            <T w={600} size={15} color="#4A5468" lh={1.45} style={{ maxWidth: 310, textAlign: 'center' }}>Yuklab olingan darslar ishlaydi. Natijalar internet qaytganda saqlanadi.</T>
          </View>

          <View style={styles.secHead}>
            <T w={800} size={12} color="#4A5468" style={{ letterSpacing: 0.72, textTransform: 'uppercase' }}>Qurilmada saqlangan</T>
            <T w={700} size={12} color="#4A5468">{mb(0)}</T>
          </View>

          {items.map((it) => (
            <Row key={it.key} onPress={() => go(it.href)}>
              <View style={[styles.thumb, { backgroundColor: it.bg }]}>
                <Image source={designImages[it.img]} style={{ width: 42, height: 42 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T w={800} size={15}>{it.title}</T>
                <T w={600} size={13} color="#4A5468" numberOfLines={1}>{it.sub}</T>
              </View>
              <View style={styles.right}>
                <SavedIcon done={false} />
                <T w={700} size={12} color="#5B6478">{mb(0)}</T>
              </View>
            </Row>
          ))}

          <View style={styles.liveNote}>
            <LiveIcon />
            <T w={600} size={13} color="#4A5468" lh={1.35} style={{ flex: 1 }}>
              {live ? `Jonli dars (${live}) uchun internet kerak` : 'Jonli dars uchun internet kerak'}
            </T>
          </View>

          <View style={styles.memory}>
            <T w={800} size={14}>Telefon xotirasi</T>
            <View accessibilityRole="image" accessibilityLabel={`Xotira: Domwork ${mb(0)}, boshqa ilovalar, boʻsh`} style={styles.memBar}>
              <View style={{ width: '0%', backgroundColor: '#2F5BFF' }} />
              <View style={{ width: '0%', backgroundColor: '#8A94A8' }} />
            </View>
            <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.legendItem}>
                <View style={[styles.sw, { backgroundColor: '#2F5BFF' }]} />
                <T w={700} size={12} color="#4A5468">Domwork {mb(0)}</T>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.sw, { backgroundColor: '#8A94A8' }]} />
                <T w={700} size={12} color="#4A5468">Boshqa ilovalar</T>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.sw, { backgroundColor: '#E2E6EE', borderWidth: 1, borderColor: '#C9D0DE' }]} />
                <T w={700} size={12} color="#4A5468">Boʻsh</T>
              </View>
            </View>
          </View>
        </View>
      </Column>
    </ScrollView>
  );
}

/** Hajm: o'nli kasr vergul bilan (dizayndagi "1,2 MB"). */
function mb(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} MB`;
}

function Row({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { marginTop: 14, marginHorizontal: 20, backgroundColor: '#0B1220', borderRadius: 18, paddingVertical: 8, paddingRight: 8, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  retry: { height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1B2438', justifyContent: 'center', flexShrink: 0 },
  body: { paddingTop: 18, paddingHorizontal: 20, gap: 10 },
  hero: { alignItems: 'center', gap: 6 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  right: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  memory: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, gap: 7 },
  memBar: { height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', flexDirection: 'row', gap: 2, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, columnGap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sw: { width: 8, height: 8, borderRadius: 2 },
  liveNote: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#D5DBE7', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
