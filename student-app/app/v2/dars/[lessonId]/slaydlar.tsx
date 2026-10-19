/**
 * v2 Slaydlar (dizayn: 11 Slides).
 *
 * Slaydlar eski speaking/slides.tsx kabi getResolvedLessonContent'dan;
 * ekran ochilganda markDone('slidesWatch') qo'yiladi (eski ilova bilan bir xil).
 * Slayd sarlavhasi "Takrorlash — хочу · могу · можно" ko'rinishida bo'lsa,
 * "—" dan oldingisi overline, keyingisi katta qator bo'ladi.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pad, splitTitle } from '@/components/v2/lessons/data';
import { BackIcon, ChevronRight, TelegramIcon } from '@/components/v2/lessons/icons';
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
  const { title: overTitle, phrase } = cur ? splitTitle(cur.title) : { title: '', phrase: '' };
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
            {cur.imageUrl ? (
              <Image source={{ uri: cur.imageUrl }} style={styles.slideImg} resizeMode="cover" accessibilityLabel={`${active + 1}-slayd: ${cur.title}`} />
            ) : (
              <View style={[styles.slideImg, styles.slideEmpty]}>
                <Text style={styles.slideEmptyText}>{cur.title}</Text>
              </View>
            )}
          </View>
          <View style={{ gap: 2 }}>
            <Text style={styles.overline}>{active + 1}-slayd{phrase ? ` · ${overTitle}` : ''}</Text>
            <Text style={styles.big}>{phrase || cur.title}</Text>
          </View>
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Oldingi slayd" disabled={active === 0} onPress={() => go(active - 1)} style={[styles.navBtn, { backgroundColor: '#FFFFFF' }, active === 0 && { opacity: 0.5 }]}>
              <BackIcon />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text accessibilityLabel={`${total} dan ${active + 1}-slayd`} style={styles.counter}>{active + 1} / {total}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {slides.map((s, i) => (
                  <View key={s.id} style={[styles.dot, i === active && styles.dotOn]} />
                ))}
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Keyingi slayd" disabled={active === total - 1} onPress={() => go(active + 1)} style={[styles.navBtn, { backgroundColor: '#2F5BFF' }, active === total - 1 && { opacity: 0.5 }]}>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView ref={thumbsRef} horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs} contentContainerStyle={styles.thumbsIn}>
            {slides.map((s, i) => {
              const on = i === active;
              if (!s.imageUrl) {
                return (
                  <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${i + 1}-slayd`} onPress={() => go(i)} style={[styles.thumb, styles.thumbEmpty, on && styles.thumbOn]}>
                    <Text style={styles.thumbEmptyText}>{i + 1}</Text>
                  </Pressable>
                );
              }
              return (
                <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${i + 1}-slayd`} accessibilityState={{ selected: on }} onPress={() => go(i)} style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]}>
                  <Image source={{ uri: s.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <View style={[styles.thumbNo, { backgroundColor: on ? '#2F5BFF' : '#0B1220' }]}>
                    <Text style={styles.thumbNoText}>{i + 1}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.tip}>
            <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={{ width: 64, height: 60 }} resizeMode="contain" />
            <Text style={styles.tipText}>Ustoz jonli darsda shu slaydlarni koʻrsatadi. Darsdan keyin istalgan vaqt qayta koʻring.</Text>
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
  content: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  figure: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 8, boxShadow: '0 10px 30px rgba(11,18,32,0.10)' } as object,
  slideImg: { width: '100%', aspectRatio: 334 / 188, borderRadius: 14 },
  slideEmpty: { backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', padding: 16 },
  slideEmptyText: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: '#1E3FD1', textAlign: 'center' },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#1E3FD1', fontWeight: 'normal' },
  big: { fontFamily: fonts.bodyHeavy, fontSize: 20, lineHeight: 27, color: '#0B1220', fontWeight: 'normal' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: fonts.display, fontSize: 22, color: '#0B1220', fontVariant: ['tabular-nums'], fontWeight: 'normal' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9D0DE' },
  dotOn: { width: 16, backgroundColor: '#2F5BFF' },
  thumbs: { marginHorizontal: -20, flexGrow: 0 },
  thumbsIn: { paddingVertical: 2, paddingHorizontal: 20, gap: 8 },
  thumb: { width: 96, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', position: 'relative' },
  thumbOff: { borderWidth: 1, borderColor: '#D5DBE7' },
  thumbOn: { borderWidth: 3, borderColor: '#2F5BFF' },
  thumbEmpty: { backgroundColor: '#E7EBF3', alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#4A5468', fontWeight: 'normal' },
  thumbNo: { position: 'absolute', left: 4, bottom: 3, minWidth: 18, height: 18, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  thumbNoText: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: '#FFFFFF', fontWeight: 'normal' },
  tip: { backgroundColor: '#FFF4D1', borderRadius: 20, paddingVertical: 14, paddingRight: 16, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: '#4A3200', fontWeight: 'normal' },
  tg: { height: 56, borderRadius: 18, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  tgText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
});
