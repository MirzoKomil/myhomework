/**
 * Kompyuter: Yangi so'zlar kartasi (dizayn: D_Vocab.dc.html) — fokus rejim.
 *
 * Mantiq mobil Vocab ekrani bilan bir xil: so'zlar getResolvedLessonContent'dan,
 * ochilganda markDone('vocabList'), har ochilgan karta markWordSeen, hammasi
 * ko'rilsa markDone('vocabPractice'); talaffuz — expo-speech; ?w= — boshlash.
 * Chap ro'yxat — kompyuterdagi qo'shimcha: bosilgan so'zga o'tadi.
 * Klaviatura: ← → so'zlar, Space tinglash, Enter dialoglarga, Esc yopish.
 * So'z turkumi/rod va misol tarjimasi serverda yo'q — ko'rsatilmaydi.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { FadeInUp } from '@/components/v2/motion';
import { markWordSeen, splitTitle, useSeenWords } from '@/components/v2/lessons/data';
import { R } from '@/constants/v2/routes';
import { getResolvedLessonContent, type LessonContent, type VocabWord } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { getCategoryProgress, markDone, useLessonProgress } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';
import { playSfx } from '@/services/sfx';

import { FocusFrame, FocusProgress, Kbd, KbdHint } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { IArrow, ICheck, ISpeaker, T, InKbd } from './ui';

export function DVocab({ id }: { id: string }) {
  const { w } = useLocalSearchParams<{ w?: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(() => Math.max(0, Number(w) || 0));
  const seen = useSeenWords(id);
  // Tor oyna (<1300): karta 1440 dagidan ancha tor — doira va so'z kichrayadi.
  const narrow = useWindowDimensions().width < 1300;
  useLessonProgress(id);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const lesson = mc.lessons.find((l) => l.id === id);
        const i = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId).findIndex((l) => l.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, i));
        if (cancelled) return;
        setNumber(i + 1);
        setName(lesson?.name ?? '');
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    markDone(id, 'vocabList');
    saveLastPosition({ lessonId: id, section: 'vocabulary/list', label: "So'zlar" });
  }, [id]);

  const words = content?.vocabulary ?? [];
  const total = words.length;
  const cur = total ? Math.min(idx, total - 1) : 0;
  const word: VocabWord | undefined = words[cur];
  const reviewing = getCategoryProgress(id, 'vocabulary') >= 100;
  const speechLang = content?.lang === 'russian' ? 'ru-RU' : 'en-US';
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: speechLang, rate: 0.9 });
  };

  // Karta ochildi — "ko'rildi"; hammasi ko'rilsa so'zlar qadami bajariladi (mobil bilan bir xil).
  useEffect(() => {
    if (!word) return;
    markWordSeen(id, word.id);
    const all = new Set([...seen, word.id]);
    if (total && words.every((x) => all.has(x.id)) && getCategoryProgress(id, 'vocabulary') < 100) {
      markDone(id, 'vocabPractice');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, id]);

  const goTo = (n: number) => {
    if (!total) return;
    playSfx('flip');
    setIdx(((n % total) + total) % total);
  };
  const toDialogs = () => router.push(R.audioDialog(id) as Href);

  useDesktopKeys({
    ArrowLeft: () => goTo(cur - 1),
    ArrowRight: () => goTo(cur + 1),
    ' ': () => word && speak(word.english),
    Enter: toDialogs,
  });

  const position = total ? cur + 1 : 0;
  const segs = (total ? words : [null]).map((_, k) => (!total ? '#E2E6EE' : k < cur ? '#087A4A' : k === cur ? '#9FDCBE' : '#E2E6EE'));

  return (
    <FocusFrame
      closeTo={R.wordList(id)}
      title={`Yangi soʻzlar${number ? ` · ${number}-dars` : ''}`}
      subtitle={name ? splitTitle(name).title : undefined}
      center={<FocusProgress left={`Soʻz ${position} / ${total}`} right={reviewing ? 'takrorlash' : undefined} rightColor="#4A5468" segments={segs} label={`${total} soʻzdan ${position}-si`} />}
      footer={
        <>
          <KbdHint keys={['←', '→']} label="soʻzlar" />
          <KbdHint keys={['Space']} label="tinglash" />
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Keyingi soʻz: ${words[(cur + 1) % Math.max(1, total)]?.english ?? ''}`} onPress={() => goTo(cur + 1)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
            <T size={16}>Keyingi soʻz</T>
            <Kbd>→</Kbd>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={toDialogs} style={({ pressed }) => [s.primary, pressed && { backgroundColor: '#1E3FD1' }]}>
            <T size={16} color="#FFFFFF">
              Dialoglarga
            </T>
            <IArrow size={18} />
            <InKbd>Enter</InKbd>
          </Pressable>
        </>
      }
      scroll={false}
    >
      <View style={s.stage}>
        {!content || !word ? (
          <T f="body" size={14} color="#4A5468">
            {error ? 'Soʻzlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali soʻz qoʻshilmagan.' : 'Yuklanmoqda…'}
          </T>
        ) : (
          <View style={s.wrap}>
            <View accessibilityLabel={`${number ?? ''}-dars soʻzlari`} style={s.nav}>
              <T size={12} color="#4A5468" ls={0.96} style={{ textTransform: 'uppercase', paddingHorizontal: 4, paddingBottom: 6 }}>
                {total} ta soʻz
              </T>
              <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
                {words.map((x, k) => {
                  const on = k === cur;
                  const passed = k < cur;
                  return (
                    <Pressable key={x.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setIdx(k)} style={[s.item, on && { backgroundColor: '#2F5BFF' }]}>
                      <View style={[s.badge, { backgroundColor: on ? '#FFFFFF' : passed ? '#E3F7EE' : '#EEF1F7' }]}>
                        {passed ? (
                          <ICheck size={13} color="#087A4A" strokeWidth={3.2} />
                        ) : (
                          <T size={13} color={on ? '#1E3FD1' : '#4A5468'}>
                            {k + 1}
                          </T>
                        )}
                      </View>
                      <T size={17} color={on ? '#FFFFFF' : '#0B1220'} lines={1} style={{ flex: 1 }}>
                        {x.english}
                      </T>
                      <T f="bodyBold" size={13} color={on ? '#FFFFFF' : '#4A5468'} lines={1}>
                        {x.translation}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <FadeInUp key={cur} distance={8} duration={260} style={{ flex: 1, minWidth: 0 }}>
              <View accessibilityLabel="Soʻz kartasi" style={[s.card, narrow && { padding: 24, gap: 24 }]}>
                <View style={[s.circle, narrow && { width: 240, height: 240, borderRadius: 120 }]}>
                  {word.imageUrl ? (
                    <Image source={{ uri: word.imageUrl }} style={{ width: narrow ? 190 : 280, height: narrow ? 190 : 280 }} resizeMode="contain" accessibilityLabel={word.translation} />
                  ) : (
                    <Ionicons name={word.icon} size={140} color="#FF7A1A" accessibilityElementsHidden />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <T f="display" size={narrow ? 60 : 88} lh={narrow ? 62 : 88} ls={narrow ? -1.2 : -1.76} style={{ flexShrink: 1 }} lines={2}>
                      {word.english}
                    </T>
                    <Pressable accessibilityRole="button" accessibilityLabel="Talaffuzni tinglash (Space)" onPress={() => speak(word.english)} style={({ pressed }) => [s.speak, pressed && { opacity: 0.8 }]}>
                      <ISpeaker />
                    </Pressable>
                  </View>
                  {!!word.transcript && (
                    <T f="bodyBold" size={20} color="#4A5468" style={{ marginTop: -6 }}>
                      {word.transcript}
                    </T>
                  )}
                  <T size={34} lh={37.4} color="#6A3CF0">
                    {word.translation}
                  </T>
                  {!!word.exampleSentence && (
                    <View style={s.example}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <T size={19}>{word.exampleSentence}</T>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel="Misol gapni tinglash" onPress={() => speak(word.exampleSentence!)} style={({ pressed }) => [s.exBtn, pressed && { opacity: 0.8 }]}>
                        <ISpeaker size={20} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </FadeInUp>
          </View>
        )}
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  // Past oynada ro'yxat o'zi aylanadi — sarlavha/pastki panel ustiga chiqmaydi.
  wrap: { width: 1120, maxWidth: '100%', maxHeight: '100%', flexDirection: 'row', gap: 24, alignItems: 'stretch' },
  nav: { width: 280, flexShrink: 0, minHeight: 0, gap: 6 },
  item: { height: 62, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 34, flexDirection: 'row', alignItems: 'center', gap: 40 },
  circle: { width: 350, height: 350, borderRadius: 175, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  speak: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  example: { backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 14, paddingRight: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  exBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  second: { height: 56, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: { height: 56, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
});
