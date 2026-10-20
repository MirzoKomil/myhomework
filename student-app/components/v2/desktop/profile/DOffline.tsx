/**
 * Kompyuter: Oflayn darslar (dizayn: D_Offline).
 *
 * Mantiq mobil ekran (app/v2/oflayn.tsx) bilan bir xil: darslarni yuklab
 * olish funksiyasi ilovada hozircha YO'Q — ro'yxatda joriy darsning real
 * materiallari (so'zlar, audio dialoglar, oxirgi videodars) "yuklanmagan"
 * holatda, hajmlar 0 MB. "Internet yoʻq" paneli faqat oflayn paytda
 * (navigator.onLine) ko'rinadi. Qurilma xotirasini o'qiydigan kutubxona yo'q —
 * Domwork 0 MB, boshqa ilovalar va bo'sh joy o'lchovsiz.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { getAudioTracks } from '@/components/v2/lessons/data';
import { parseDur } from '@/components/v2/library/data';
import { currentLesson, latestVideoLesson, mmss, pad2 } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedLessonContent } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchMobileContent, invalidateCache } from '@/services/contentApi';

import { ChevronIcon, go, H, Over, SettingsLayout, T, VideoIcon } from './ui';

type Item = { key: string; title: string; sub: string; bg: string; img: keyof typeof designImages; href: string };

function isOnline() {
  return Platform.OS !== 'web' || typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
function liveLabel(d: Date) {
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? `bugun ${time}` : time;
}
/** Hajm: o'nli kasr vergul bilan ("1,2 MB"). */
const mb = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} MB`;

const NoWifi = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFC93C" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 8.5a15 15 0 0 1 4.5-2.8M10 4.6A15 15 0 0 1 22 8.5M5 12.5a10 10 0 0 1 4-2.2M14.5 10.4a10 10 0 0 1 4.5 2.1M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
  </Svg>
);
const Retry = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Svg>
);
/** Yuklangan — yashil belgili doira; yuklanmagan — kulrang bo'sh doira. */
const Saved = ({ done }: { done: boolean }) => (
  <Svg accessibilityRole="image" accessibilityLabel={done ? 'Yuklab olingan' : 'Yuklanmagan'} width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={done ? '#087A4A' : '#5B6478'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    {done ? <Path d="M8 12.5l2.8 2.8L16.5 9.5" /> : null}
  </Svg>
);

export function DOffline() {
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
        out.push({ key: 'audio', title: `${cur.number}-dars · audio dialoglar`, sub: `${tracks.length} ta dialog${secs ? ` · ${mmss(secs)}` : ''}`, bg: '#E8EEFF', img: '32eee84d436da97eb104c837c0065230', href: R.audioDialog(cur.lesson.id) });
      }
      const vid = latestVideoLesson(mc, cur);
      if (vid) out.push({ key: 'video', title: `${vid.number}-dars · videodars`, sub: vid.lesson.name, bg: '#E3F7EE', img: 'f639c30e1400761df83230b833ba42b2', href: R.video(vid.lesson.id) });
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
    <SettingsLayout active="offline" title="Oflayn darslar" subtitle={`0 ta dars yuklangan · ${mb(0)}`}>
      {!online && (
        <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={s.status}>
          <NoWifi />
          <T size={16} color="#FFFFFF">
            Internet yoʻq
          </T>
          <T f="body" size={14} color="#C9D1E0">
            · natijalar internet qaytganda saqlanadi
          </T>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" onPress={retry} style={s.retry}>
            <Retry />
            <T size={14} color="#FFFFFF">
              Qayta urinish
            </T>
          </Pressable>
        </View>
      )}

      <View style={s.hero}>
        <Image source={designImages['78f533d49645c292f499fbc1b6168dd2']} style={{ width: 200, height: 200, marginVertical: -6 }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 8 }}>
          <H size={28} lh={1.15} role="header">
            Oflayn ham oʻqish mumkin
          </H>
          <T f="body" size={16} color="#4A5468" lh={24}>
            Yuklab olingan darslar ishlaydi. Natijalar internet qaytganda saqlanadi.
          </T>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={s.list}>
          <View style={s.listHead}>
            <Over>Qurilmada saqlangan</Over>
            <T size={13} color="#4A5468">
              {mb(0)}
            </T>
          </View>
          {items.map((it, i) => (
            <Pressable key={it.key} accessibilityRole="link" onPress={() => go(it.href)} style={[s.row, i < items.length - 1 && s.rowBorder]}>
              <View style={[s.thumb, { backgroundColor: it.bg }]}>
                <Image source={designImages[it.img]} style={{ width: 66, height: 66 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <T size={17}>{it.title}</T>
                <T f="body" size={14} color="#4A5468" lines={1}>
                  {it.sub}
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T size={14} color="#4A5468">
                  {mb(0)}
                </T>
                <Saved done={false} />
              </View>
              <ChevronIcon />
            </Pressable>
          ))}
        </View>

        <View style={s.mem}>
          <T size={18} lh={22.5} accessibilityRole="header">
            Qurilma xotirasi
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <H size={34} lh={1}>
              {mb(0)}
            </H>
            <T f="bodyBold" size={14} color="#4A5468">
              Domwork darslari
            </T>
          </View>
          <View accessibilityRole="image" accessibilityLabel={`Xotira: Domwork ${mb(0)}, boshqa ilovalar, boʻsh`} style={s.bar}>
            <View style={{ width: '0%', backgroundColor: '#2F5BFF' }} />
            <View style={{ width: '0%', backgroundColor: '#9AA6BD' }} />
          </View>
          <View style={{ marginTop: 4 }}>
            <Legend color="#2F5BFF" label="Domwork" value={mb(0)} />
            <Legend color="#9AA6BD" label="Boshqa ilovalar" value="" />
            <Legend color="#BFE8D3" label="Boʻsh" value="" />
          </View>
          <View style={s.liveNote}>
            <VideoIcon size={22} color="#4A5468" />
            <T f="bodyBold" size={14} color="#34405A" lh={19.6} style={{ flex: 1 }}>
              {live ? `Jonli dars (${live}) uchun internet kerak` : 'Jonli dars uchun internet kerak'}
            </T>
          </View>
        </View>
      </View>
    </SettingsLayout>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={s.legend}>
      <View style={[s.sw, { backgroundColor: color }]} />
      <T f="bodyBold" size={14} color="#34405A" style={{ flex: 1 }}>
        {label}
      </T>
      <T size={14}>{value}</T>
    </View>
  );
}

const s = StyleSheet.create({
  status: { height: 64, borderRadius: 20, backgroundColor: '#0B1220', paddingLeft: 22, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  retry: { height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#233049', flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingLeft: 14, paddingRight: 26, flexDirection: 'row', alignItems: 'center', gap: 22 },
  list: { flex: 1.55, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 18, paddingHorizontal: 22, paddingBottom: 6 },
  row: { flex: 1, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  thumb: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  mem: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 14 },
  bar: { height: 14, borderRadius: 7, backgroundColor: '#BFE8D3', overflow: 'hidden', flexDirection: 'row' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  sw: { width: 12, height: 12, borderRadius: 4 },
  liveNote: { marginTop: 'auto', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9D0DD', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
