/**
 * Kompyuter: Slaydlar (dizayn: D_Slides.dc.html) — fokus rejim.
 *
 * Ma'lumot mobil Slaydlar ekrani bilan bir xil: slaydlar va "Darsga
 * tayyorlaning" savollari (speakingPractice) — getResolvedLessonContent,
 * ochilganda markDone('slidesWatch'); jonli dars vaqti va Telegram havolasi —
 * demo-schedule. Kompyuterda qo'shimcha: jonli darsgacha qolgan vaqt, guruh
 * (jadval mavzusidan), ustoz (profil) va dars davomiyligi (tarif).
 * Klaviatura: ← → slaydlar, F to'liq ekran, Esc yopish.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { pad } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchDemoSchedule, fetchDemoStudentPayments, fetchDemoStudentProfile, fetchMobileContent } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';
import { stripRichText } from '@/services/richText';

import { FocusFrame, FocusProgress, Kbd, KbdHint } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { IBulb, IChevron, IChevronLeft, IFullscreen, ITelegram, T, useCountdown } from './ui';

// Rasmsiz slayd kichik ko'rinishlari ranglari — dizayndagi tartibda (4-slayddan boshlab).
const THUMB_ACCENTS = ['#2F5BFF', '#FF7A1A', '#087A4A', '#7C4DFF'];

/** "Takrorlash: хочу · могу" → "Takrorlash" (mobil bilan bir xil). */
const shortTitle = (t: string) => t.split(/\s*[:—–]\s*/)[0].trim();

function liveWhen(d: Date) {
  const now = new Date();
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (diff === 0) return `bugun ${t}`;
  if (diff === 1) return `ertaga ${t}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${t}`;
}

export function DSlides({ id }: { id: string }) {
  const { i: start } = useLocalSearchParams<{ i?: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [info, setInfo] = useState<{ number: number; isVideo: boolean; name: string } | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, Number(start) || 0));
  const [live, setLive] = useState<{ startsAt: Date | null; link: string; topic: string }>({ startsAt: null, link: '', topic: '' });
  const [teacher, setTeacher] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const thumbsRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, isVideo: idx % 2 === 0, name: l?.name ?? '' });
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    fetchDemoSchedule()
      .then((s) => !cancelled && setLive({ startsAt: s.startsAt ? new Date(s.startsAt) : null, link: s.telegramGroupLink, topic: s.topic }))
      .catch(() => {});
    fetchDemoStudentProfile()
      .then((p) => !cancelled && p && setTeacher(p.mainTeacherName))
      .catch(() => {});
    fetchDemoStudentPayments()
      .then((p) => !cancelled && p && setDuration(p.lessonDuration))
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
  const curIdx = Math.min(active, Math.max(0, total - 1));
  const cur = slides[curIdx];
  const go = (n: number) => {
    const k = Math.max(0, Math.min(total - 1, n));
    setActive(k);
    thumbsRef.current?.scrollTo({ x: Math.max(0, k * 86 - 172), animated: true });
  };
  const openViewer = () => router.push(`${R.slideViewer(id)}?i=${curIdx}` as Href);
  const questions = content?.speakingPractice ?? [];
  const liveLabel = live.startsAt ? liveWhen(live.startsAt) : '';
  const countdown = useCountdown(live.startsAt);
  const short = cur ? shortTitle(cur.title) : '';
  const group = (() => {
    const m = /^Speaking Club:\s*(.+)$/.exec(live.topic) ?? /(\S+)\s+guruh/.exec(live.topic);
    return m ? m[1].trim() : '';
  })();
  const liveMeta = [group ? `${group} guruh` : '', teacher, duration ? `${duration} daq` : ''].filter(Boolean).join(' · ');
  const subtitle = info ? `${info.number}-dars · ${info.isVideo ? 'Videodars' : 'Jonli dars'} · ${total} ta slayd` : '';
  // Pastdagi maslahat — joriy slayd matnining birinchi qatori (qisqa bo'lsa).
  const tip = (() => {
    const first = stripRichText(cur?.body ?? '').split(/\r?\n/)[0]?.trim() ?? '';
    return first.length <= 60 ? first : '';
  })();

  useDesktopKeys({ ArrowLeft: () => go(curIdx - 1), ArrowRight: () => go(curIdx + 1), f: openViewer });

  return (
    <FocusFrame
      closeTo={R.lesson(id)}
      title="Slaydlar"
      subtitle={subtitle}
      center={
        <FocusProgress
          left={`Slayd ${total ? curIdx + 1 : 0} / ${total}`}
          right={short}
          rightColor="#4A5468"
          segments={(total ? slides : [null]).map((_, k) => (total && k <= curIdx ? '#2F5BFF' : '#E2E6EE'))}
          label={`${total} dan ${curIdx + 1}-slayd`}
        />
      }
      footerHeight={100}
      footerWidth={1288}
      footer={
        <>
          <KbdHint keys={['←', '→']} label="slaydlar" />
          <KbdHint keys={['F']} label="toʻliq ekran" />
          <KbdHint keys={['Esc']} label="yopish" />
          {!!tip && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <IBulb size={16} color="#4A5468" />
              <T f="bodyBold" size={13} color="#4A5468">
                {tip}
              </T>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {!!live.link && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(live.link).catch(() => {})} style={({ pressed }) => [s.tg, pressed && { opacity: 0.9 }]}>
              <ITelegram size={19} />
              <T size={16}>Jonli dars{liveLabel ? ` · ${liveLabel}` : ''}</T>
            </Pressable>
          )}
        </>
      }
      scroll={false}
    >
      <View style={s.stage}>
        {!content || !cur ? (
          <T f="body" size={14} color="#4A5468">
            {error ? 'Slaydlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali slayd qoʻshilmagan.' : 'Yuklanmoqda…'}
          </T>
        ) : (
          <View style={s.wrap}>
            <View style={{ gap: 18, flexShrink: 1, minWidth: 0 }}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${curIdx + 1}-slaydni toʻliq ekranda ochish (F)`} onPress={openViewer} style={s.slide}>
                {cur.imageUrl ? (
                  <Image source={{ uri: cur.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`${curIdx + 1}-slayd: ${cur.title}`} />
                ) : (
                  <View style={s.slideEmpty}>
                    <T size={28} color="#1E3FD1" style={{ textAlign: 'center' }}>
                      {cur.title}
                    </T>
                  </View>
                )}
              </Pressable>
              <View style={s.nav}>
                <Pressable accessibilityRole="button" accessibilityLabel="Oldingi slayd (←)" disabled={curIdx === 0} onPress={() => go(curIdx - 1)} style={[s.prev, curIdx === 0 && { opacity: 0.5 }]}>
                  <IChevronLeft />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <T f="display" size={24} ls={-0.48}>
                      {curIdx + 1} / {total}
                    </T>
                    {!!short && (
                      <T size={16} color="#1E3FD1" lines={1}>
                        · {short}
                      </T>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {slides.map((x, k) => (
                      <View key={x.id} style={{ width: k === curIdx ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: k === curIdx ? '#2F5BFF' : '#C9D1E0' }} />
                    ))}
                  </View>
                </View>
                <Pressable accessibilityRole="link" accessibilityLabel="Toʻliq ekran (F)" onPress={openViewer} style={({ pressed }) => [s.full, pressed && { opacity: 0.85 }]}>
                  <IFullscreen />
                  <T size={15}>Toʻliq ekran</T>
                  <Kbd>F</Kbd>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Keyingi slayd (→)" disabled={curIdx === total - 1} onPress={() => go(curIdx + 1)} style={[s.next, curIdx === total - 1 && { opacity: 0.5 }]}>
                  <IChevron size={22} color="#FFFFFF" strokeWidth={2.6} />
                </Pressable>
              </View>
              <ScrollView ref={thumbsRef} horizontal showsHorizontalScrollIndicator={false} style={{ width: 866, maxWidth: '100%', marginHorizontal: -3, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 3, paddingHorizontal: 3 }}>
                {slides.map((x, k) => {
                  const on = k === curIdx;
                  const acc = THUMB_ACCENTS[(k + 1) % THUMB_ACCENTS.length];
                  return (
                    <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`${k + 1}-slayd: ${x.title}`} accessibilityState={{ selected: on }} onPress={() => go(k)} style={[s.thumb, on ? s.thumbOn : s.thumbOff]}>
                      {x.imageUrl ? (
                        <Image source={{ uri: x.imageUrl }} style={{ width: 78, height: 43 }} resizeMode="cover" />
                      ) : (
                        <>
                          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 15, backgroundColor: acc, opacity: 0.2 }} />
                          <View style={{ position: 'absolute', left: 8, top: 8, width: 28, height: 6, borderRadius: 3, backgroundColor: acc }} />
                          <View style={{ position: 'absolute', left: 8, top: 21, width: 46, height: 4, borderRadius: 2, backgroundColor: '#D5DBE7' }} />
                          <View style={{ position: 'absolute', left: 8, top: 30, width: 35, height: 4, borderRadius: 2, backgroundColor: '#E2E6EE' }} />
                        </>
                      )}
                      <View style={[s.thumbNo, { backgroundColor: on ? '#2F5BFF' : '#0B1220' }]}>
                        <T size={12} color="#FFFFFF">
                          {k + 1}
                        </T>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={s.aside}>
              <View style={s.tipCard}>
                <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={{ width: 64, height: 60 }} resizeMode="contain" />
                <T f="bodyBold" size={15} lh={21.75} color="#7A5300" style={{ flex: 1 }}>
                  Ustoz jonli darsda shu slaydlarni koʻrsatadi. Darsdan keyin ham ochiq.
                </T>
              </View>
              <View accessibilityLabel="Slayddagi savollar" style={s.qs}>
                <T size={12} color="#4A5468" ls={0.96} style={{ textTransform: 'uppercase', paddingHorizontal: 2, paddingBottom: 12 }}>
                  Darsga tayyorlaning · {questions.length} ta savol
                </T>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                  {questions.map((q, k) => (
                    <View key={q.id} style={s.qRow}>
                      <T size={17} lh={22.1}>
                        {k + 1}. {q.sentence}
                      </T>
                      {!!q.translation && (
                        <T f="body" size={14} color="#4A5468">
                          {q.translation}
                        </T>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
              {!!live.startsAt && (
                <View accessibilityLabel="Jonli dars" style={s.liveCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' }} />
                    <T size={12} color="#FF9A9E" ls={0.72} style={{ textTransform: 'uppercase' }}>
                      Jonli dars · {liveLabel}
                    </T>
                  </View>
                  <View accessibilityRole="timer" accessibilityLabel={countdown.label}>
                    <T f="display" size={30} color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
                      {countdown.text}
                    </T>
                  </View>
                  {!!liveMeta && (
                    <T f="body" size={13} color="#B8C1D6">
                      {liveMeta}
                    </T>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  wrap: { flexDirection: 'row', gap: 28, alignItems: 'flex-start', maxWidth: '100%' },
  slide: { width: 860, maxWidth: '100%', aspectRatio: 860 / 483, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: '0 1px 0 #E2E6EE, 0 18px 40px rgba(11,18,32,0.10)' } as object,
  slideEmpty: { flex: 1, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  nav: { width: 860, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  prev: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#FFFFFF', boxShadow: 'inset 0 0 0 2px #E2E6EE', alignItems: 'center', justifyContent: 'center' } as object,
  next: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1', alignItems: 'center', justifyContent: 'center' } as object,
  full: { height: 52, paddingHorizontal: 16, borderRadius: 17, backgroundColor: '#FFFFFF', boxShadow: 'inset 0 0 0 2px #E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 8 } as object,
  thumb: { position: 'relative', width: 78, height: 43, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  thumbOff: { boxShadow: 'inset 0 0 0 1px #D5DBE7' } as object,
  thumbOn: { boxShadow: '0 0 0 3px #2F5BFF' } as object,
  thumbNo: { position: 'absolute', left: 5, bottom: 5, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  aside: { width: 400, flexShrink: 0, alignSelf: 'stretch', gap: 16 },
  tipCard: { backgroundColor: '#FFF4D1', borderRadius: 22, paddingVertical: 14, paddingLeft: 12, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qs: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  qRow: { flexGrow: 1, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: '#EEF1F7', gap: 3 },
  liveCard: { backgroundColor: '#0B1220', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, gap: 2 },
  tg: { height: 56, paddingHorizontal: 24, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1B8CC7' } as object,
});
