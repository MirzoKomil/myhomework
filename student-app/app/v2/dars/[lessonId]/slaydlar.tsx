/**
 * v2 Slaydlar (dizayn: 11 Slides).
 *
 * Slaydlar eski speaking/slides.tsx kabi getResolvedLessonContent'dan;
 * ekran ochilganda markDone('slidesWatch') qo'yiladi (eski ilova bilan bir xil).
 * Hisoblagich yonidagi qisqa nom — slayd sarlavhasining ":"/"—" dan oldingi qismi.
 * Rasm yoki "To'liq ekran" bosilsa — SlideViewer (?i=<raqam>).
 * "Darsga tayyorlaning" savollari — darsning speakingPractice (gap + tarjima) ro'yxati.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pad } from '@/components/v2/lessons/data';
import { BackIcon, ChevronRight, FullscreenIcon, TelegramIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, TitleHeader } from '@/components/v2/lessons/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchMobileContent } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function SlidesScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [info, setInfo] = useState<{ number: number; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [live, setLive] = useState<{ startsAt: Date | null; link: string }>({ startsAt: null, link: '' });
  const thumbsRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, isVideo: idx % 2 === 0 });
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    fetchDemoSchedule()
      .then((s) => !cancelled && setLive({ startsAt: s.startsAt ? new Date(s.startsAt) : null, link: s.telegramGroupLink }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    markDone(id, 'slidesWatch');
    saveLastPosition({ lessonId: id, section: 'speaking/slides', label: 'Slaydlar' });
  }, [id]);

  const slides = content?.slides ?? [];
  const total = slides.length;
  const cur = slides[active];
  const go = (i: number) => {
    const n = Math.max(0, Math.min(total - 1, i));
    setActive(n);
    thumbsRef.current?.scrollTo({ x: Math.max(0, n * 104 - 104), animated: true });
  };
  const subtitle = info ? `${info.number}-dars · ${info.isVideo ? 'Videodars' : 'Jonli dars'} · ${total} ta slayd` : '';
  const short = cur ? shortTitle(cur.title) : '';
  const openViewer = () => router.push(`${R.slideViewer(id)}?i=${active}` as Href);
  const questions = content?.speakingPractice ?? [];
  const liveLabel = live.startsAt ? liveWhen(live.startsAt) : '';

  if (!content || !cur) {
    return (
      <View style={styles.screen}>
        <Column>
          <TitleHeader title="Slaydlar" subtitle={subtitle} fallback={R.lesson(id)} />
          <Center>
            <Text style={styles.muted}>{error ? 'Slaydlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali slayd qoʻshilmagan.' : 'Yuklanmoqda…'}</Text>
          </Center>
        </Column>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Column>
        <TitleHeader title="Slaydlar" subtitle={subtitle} fallback={R.lesson(id)} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.figure}>
            <Pressable accessibilityRole="link" accessibilityLabel={`${active + 1}-slaydni toʻliq ekranda ochish`} onPress={openViewer} style={{ borderRadius: 14 }}>
              {cur.imageUrl ? (
                <Image source={{ uri: cur.imageUrl }} style={styles.slideImg} resizeMode="cover" accessibilityLabel={`${active + 1}-slayd: ${cur.title}`} />
              ) : (
                <View style={[styles.slideImg, styles.slideEmpty]}>
                  <Text style={styles.slideEmptyText}>{cur.title}</Text>
                </View>
              )}
            </Pressable>
          </View>
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Oldingi slayd" disabled={active === 0} onPress={() => go(active - 1)} style={[styles.navBtn, { backgroundColor: '#FFFFFF' }, active === 0 && { opacity: 0.5 }]}>
              <BackIcon />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View accessibilityLabel={`${total} dan ${active + 1}-slayd${short ? `: ${short}` : ''}`} style={styles.counterRow}>
                <Text style={styles.counter}>{active + 1} / {total}</Text>
                {!!short && <Text style={styles.counterName} numberOfLines={1}>· {short}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {slides.map((s, i) => (
                  <View key={s.id} style={[styles.dot, i === active && styles.dotOn]} />
                ))}
              </View>
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel="Toʻliq ekran" onPress={openViewer} style={({ pressed }) => [styles.fullBtn, pressed && { opacity: 0.85 }]}>
              <FullscreenIcon />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Keyingi slayd" disabled={active === total - 1} onPress={() => go(active + 1)} style={[styles.navBtn, { backgroundColor: '#2F5BFF' }, active === total - 1 && { opacity: 0.5 }]}>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView ref={thumbsRef} horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs} contentContainerStyle={styles.thumbsIn}>
            {slides.map((s, i) => {
              const on = i === active;
              if (!s.imageUrl) {
                // Rasmsiz slayd — dizayndagi sxematik kichik ko'rinish (rangli sarlavha, sariq progress).
                const acc = THUMB_ACCENTS[(i + 4) % THUMB_ACCENTS.length];
                return (
                  <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${i + 1}-slayd: ${s.title}`} accessibilityState={{ selected: on }} onPress={() => go(i)} style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]}>
                    <View style={[styles.tBand, { backgroundColor: acc }]} />
                    <View style={[styles.tBar, { backgroundColor: acc }]} />
                    <View style={[styles.tProg, { width: `${((i + 1) / total) * 100}%` }]} />
                    <View style={[styles.thumbNo, { bottom: 5, backgroundColor: on ? '#2F5BFF' : '#0B1220' }]}>
                      <Text style={styles.thumbNoText}>{i + 1}</Text>
                    </View>
                  </Pressable>
                );
              }
              return (
                <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${i + 1}-slayd: ${s.title}`} accessibilityState={{ selected: on }} onPress={() => go(i)} style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]}>
                  <Image source={{ uri: s.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <View style={[styles.thumbNo, { backgroundColor: on ? '#2F5BFF' : '#0B1220' }]}>
                    <Text style={styles.thumbNoText}>{i + 1}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.tip}>
            <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={{ width: 44, height: 40 }} resizeMode="contain" />
            <Text style={styles.tipText}>Ustoz jonli darsda shu slaydlarni koʻrsatadi. Darsdan keyin ham ochiq.</Text>
          </View>
          <View accessibilityLabel="Slayddagi savollar" style={styles.qs}>
            <Text style={styles.qsTitle}>Darsga tayyorlaning · {questions.length} ta savol</Text>
            {questions.map((q, k) => (
              <View key={q.id} style={styles.qRow}>
                <Text style={styles.qRu}>{k + 1}. {q.sentence}</Text>
                {!!q.translation && <Text style={styles.qUz}>{q.translation}</Text>}
              </View>
            ))}
          </View>
        </ScrollView>
        {!!live.link && (
          <BottomBar>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(live.link).catch(() => {})} style={({ pressed }) => [styles.tg, pressed && { opacity: 0.9 }]}>
              <TelegramIcon />
              <Text style={styles.tgText}>Jonli dars{liveLabel ? ` · ${liveLabel}` : ''}</Text>
            </Pressable>
          </BottomBar>
        )}
      </Column>
    </View>
  );
}

// Rasmsiz slayd kichik ko'rinishlari ranglari — dizayndagi tartibda.
const THUMB_ACCENTS = ['#2F5BFF', '#FF7A1A', '#7C4DFF', '#087A4A', '#FF7A1A', '#2F5BFF', '#7C4DFF'];

/** "Takrorlash: хочу · могу" → "Takrorlash". */
function shortTitle(t: string) {
  return t.split(/\s*[:—–]\s*/)[0].trim();
}

function liveWhen(d: Date) {
  const now = new Date();
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (diff === 0) return `bugun ${t}`;
  if (diff === 1) return `ertaga ${t}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${t}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  muted: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', textAlign: 'center' },
  content: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  figure: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 8, boxShadow: '0 10px 30px rgba(11,18,32,0.10)' } as object,
  slideImg: { width: '100%', aspectRatio: 334 / 188, borderRadius: 14 },
  slideEmpty: { backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', padding: 16 },
  slideEmptyText: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: '#1E3FD1', textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, maxWidth: '100%' },
  counter: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24.2, color: '#0B1220', fontVariant: ['tabular-nums'], fontWeight: 'normal' },
  counterName: { flexShrink: 1, fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#1E3FD1', fontWeight: 'normal' },
  fullBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5DBE7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9D0DE' },
  dotOn: { width: 16, backgroundColor: '#2F5BFF' },
  thumbs: { marginHorizontal: -20, flexGrow: 0 },
  thumbsIn: { paddingVertical: 2, paddingHorizontal: 20, gap: 8 },
  thumb: { width: 96, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', position: 'relative' },
  thumbOff: { borderWidth: 1, borderColor: '#D5DBE7' },
  thumbOn: { borderWidth: 3, borderColor: '#2F5BFF' },
  tBand: { position: 'absolute', left: 0, right: 0, top: 0, height: 22, opacity: 0.22 },
  tBar: { position: 'absolute', left: 8, top: 8, width: 30, height: 6, borderRadius: 3 },
  tProg: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: '#FFC93C' },
  thumbNo: { position: 'absolute', left: 4, bottom: 3, minWidth: 18, height: 18, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  thumbNoText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#FFFFFF', fontWeight: 'normal' },
  tip: { backgroundColor: '#FFF4D1', borderRadius: 20, paddingVertical: 6, paddingRight: 14, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17.55, color: '#4A3200', fontWeight: 'normal' },
  qs: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 4 },
  qsTitle: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', textTransform: 'uppercase', letterSpacing: 0.72, paddingBottom: 3, fontWeight: 'normal' },
  qRow: { paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  qRu: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  qUz: { fontFamily: fonts.body, fontSize: 13, lineHeight: 16.9, color: '#4A5468', fontWeight: 'normal' },
  tg: { height: 56, borderRadius: 18, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  tgText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
});
