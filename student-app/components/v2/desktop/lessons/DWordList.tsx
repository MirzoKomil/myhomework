/**
 * Kompyuter: Darsning so'zlari (dizayn: D_WordList.dc.html).
 *
 * Ma'lumot mobil ekrandagi bilan bir xil: so'zlar getResolvedLessonContent'dan,
 * "o'rganildi" — learnedWordIds. So'zga bosilsa — shu so'zdan kartalar
 * (Vocab ?w=). Karnay tugmasi so'zni o'qiydi (expo-speech, Vocab'dagi kabi).
 * To'r: 4 ustun, ekranga 2 qator sig'adi; so'z ko'p bo'lsa pastga aylanadi.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { learnedWordIds, useSeenWords } from '@/components/v2/lessons/data';
import { R } from '@/constants/v2/routes';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { useLessonProgress } from '@/services/lessonProgressStore';

import { DesktopPage } from '../Shell';
import { IArrow, IBulb, ICheck, ISpeaker, T } from './ui';

// Kartochka rasm foni — mobil ekrandagi tartib (dizayn bilan bir xil).
const TILE_BG = ['#E8EEFF', '#FFF4D1', '#F0EBFF', '#FFF1E6', '#E3F7EE', '#FDECEC'];
const COLS = 4;

export function DWordList({ id }: { id: string }) {
  const [content, setContent] = useState<LessonContent | null>(null);
  const [info, setInfo] = useState<{ number: number; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [gridH, setGridH] = useState(0);
  const seen = useSeenWords(id);
  useLessonProgress(id);

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
    return () => {
      cancelled = true;
    };
  }, [id]);

  const words = content?.vocabulary ?? [];
  const learned = learnedWordIds(id, words.map((w) => w.id), seen);
  const open = (i: number) => router.push(`${R.vocab(id)}?w=${i}` as Href);
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: content?.lang === 'russian' ? 'ru-RU' : 'en-US', rate: 0.9 });
  };
  // Qator balandligi: ekranga 2 qator sig'adi (dizayndagidek), juda past oynada kamida 280.
  const rowH = gridH ? Math.max(280, (gridH - 16) / 2) : 0;
  const rows = Array.from({ length: Math.ceil(words.length / COLS) }, (_, r) => words.slice(r * COLS, r * COLS + COLS).map((w, k) => ({ w, i: r * COLS + k })));

  return (
    <DesktopPage
      title="Yangi soʻzlar"
      subtitle={info ? `${info.number}-dars · ${info.isVideo ? 'Videodars' : 'Jonli dars'}` : undefined}
      back={R.lesson(id)}
      scroll={false}
      contentStyle={{ flex: 1, minHeight: 0, gap: 18 }}
      actions={
        <View style={s.pill}>
          <ICheck size={16} color="#087A4A" />
          <T size={14} color="#075E3A">
            {learned.size} / {words.length} oʻrganildi
          </T>
        </View>
      }
    >
      <View style={s.bar}>
        <View style={s.bulb}>
          <IBulb />
        </View>
        <T f="bodyBold" size={15} color="#34405A" style={{ flex: 1 }}>
          Soʻzga bosing — rasm, talaffuz va misol gap bilan karta ochiladi.
        </T>
        <Pressable accessibilityRole="link" onPress={() => router.push(R.wordReview as Href)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
          <T size={16}>Takrorlash</T>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => open(0)} style={({ pressed }) => [s.primary, pressed && { backgroundColor: '#1E3FD1' }]}>
          <T size={16} color="#FFFFFF">
            Kartalarni ochish
          </T>
          <IArrow size={18} />
        </Pressable>
      </View>
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
        {!content || !words.length ? (
          <T f="body" size={14} color="#4A5468">
            {error ? 'Soʻzlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali soʻz qoʻshilmagan.' : 'Yuklanmoqda…'}
          </T>
        ) : (
          <ScrollView accessibilityRole="list" accessibilityLabel={`${words.length} ta soʻz`} style={{ flex: 1 }} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
            {rows.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: 16, height: rowH || undefined }}>
                {row.map(({ w, i }) => (
                  <View key={w.id} style={s.tile}>
                    <Pressable accessibilityRole="link" accessibilityLabel={`${w.translation} — kartani ochish`} onPress={() => open(i)} style={{ flex: 1, minHeight: 0 }}>
                      <View style={[s.img, { backgroundColor: TILE_BG[i % TILE_BG.length] }]}>
                        {w.imageUrl ? (
                          <Image source={{ uri: w.imageUrl }} style={{ width: 150, height: 150, maxHeight: '90%' }} resizeMode="contain" />
                        ) : (
                          <Ionicons name={w.icon} size={84} color="#FF7A1A" accessibilityElementsHidden />
                        )}
                        {learned.has(w.id) && (
                          <View accessibilityLabel="oʻrganildi" style={s.badge}>
                            <ICheck size={14} strokeWidth={3.2} />
                          </View>
                        )}
                      </View>
                      <View style={s.words}>
                        <T size={24} lh={27.6} lines={1}>
                          {w.english}
                        </T>
                        <T f="bodyBold" size={15} lh={19.5} color="#4A5468" lines={1}>
                          {w.translation}
                        </T>
                      </View>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Tinglash: ${w.translation}`} onPress={() => speak(w.english)} style={({ pressed }) => [s.speak, pressed && { opacity: 0.8 }]}>
                      <ISpeaker size={21} />
                    </Pressable>
                  </View>
                ))}
                {Array.from({ length: COLS - row.length }, (_, k) => (
                  <View key={`e${k}`} style={{ flex: 1 }} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  pill: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingRight: 12, paddingLeft: 20 },
  bulb: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  second: { height: 50, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', justifyContent: 'center' },
  primary: { height: 50, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
  tile: { flex: 1, minWidth: 0, position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 10 },
  img: { flex: 1, minHeight: 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', right: 10, top: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#087A4A', borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  words: { gap: 2, paddingTop: 12, paddingRight: 64, paddingBottom: 6, paddingLeft: 8 },
  speak: { position: 'absolute', right: 18, bottom: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
});
