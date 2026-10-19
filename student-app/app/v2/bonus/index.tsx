/**
 * v2 Bonus darslar (dizayn: 21 · Bonus).
 *
 * Ma'lumot eski homework/bonus.tsx bilan bir xil: 18 ta bonus dars,
 * turi BONUS_CATEGORIES'dan, sanasi — kurs boshlanganidan keyingi har
 * yakshanba, ochilganlar soni UNLOCKED_COUNT (eski ekrandagi qoida).
 * "Ko'rildi" — lessonProgressStore'dagi videoWatch. Bonus dars — v2
 * BonusPlayer (bonus/[bonusId].tsx). Bonus vaqti (soat) serverda yo'q,
 * shuning uchun faqat sana ko'rsatiladi. Eslatma tugmasi — shu qurilmadagi
 * sozlama (bonusData.ts), serverga hech narsa yuborilmaydi.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BellIcon, Check, ChevronRight, PlayIcon } from '@/components/v2/homework/icons';
import { LessonsTop } from '@/components/v2/homework/LessonsTop';
import { LessonsNav, Txt } from '@/components/v2/homework/ui';
import { loadCourseData } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { BONUS_LESSONS, TOTAL, UNLOCKED_COUNT, short, useBonusReminder, whenLabel } from '@/components/v2/homework/bonusData';
import { getLessonProgress, loadLessonProgress, subscribe } from '@/services/lessonProgressStore';

export default function BonusScreen() {
  const [, setTick] = useState(0);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    loadLessonProgress().then(() => setTick((t) => t + 1));
    loadCourseData()
      .then((d) => d && setDone(d.lessons.filter((l) => l.completed).length))
      .catch(() => {});
    return subscribe(() => setTick((t) => t + 1));
  }, []);

  const watched = (id: string) => getLessonProgress(id).videoWatch;
  const watchedCount = BONUS_LESSONS.filter((b) => watched(b.id)).length;
  const next = BONUS_LESSONS[UNLOCKED_COUNT];
  // Ochilgan bonuslar — eng yangisi tepada.
  const past = BONUS_LESSONS.slice(0, UNLOCKED_COUNT).reverse();
  const open = (id: string) => router.push(R.bonusPlayer(id) as Href);
  const [reminder, setReminder] = useBonusReminder();

  return (
    <View style={st.screen}>
      <View style={st.column}>
        <LessonsTop active="bonus" done={done} total={72} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          {next && (
            <View style={st.hero}>
              <Image source={designImages['8c685006bea3b1898e962d7116efecbd']} resizeMode="contain" style={st.heroImg} accessibilityElementsHidden />
              <Txt f="bodyHeavy" size={11} color="#5A2FD6" style={st.chip}>
                Keyingi bonus
              </Txt>
              <Txt f="display" size={22} lh={24.2} color="#FFFFFF" style={{ maxWidth: 210 }}>
                {next.category.label}
              </Txt>
              <Txt f="bodyBold" size={14} color="#FFFFFF">
                {whenLabel(next.date)}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#9B78FF', overflow: 'hidden' }}>
                  <View style={{ width: `${(watchedCount / TOTAL) * 100}%`, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
                </View>
                <Txt f="bodyHeavy" size={13} color="#FFFFFF">
                  {watchedCount} / {TOTAL} koʻrildi
                </Txt>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: reminder }}
                accessibilityLabel={`Eslatma: ${short(next.date)}`}
                onPress={() => setReminder(!reminder)}
                style={({ pressed }) => [st.remind, pressed && st.pressed]}
              >
                <BellIcon />
                <View style={{ flex: 1 }}>
                  <Txt f="bodyHeavy" size={15} lh={17.25} color="#5A2FD6">
                    Eslatma
                  </Txt>
                  <Txt f="bodyBold" size={12} lh={13.8} color="#4A5468">
                    30 daqiqa oldin · Telegram bot
                  </Txt>
                </View>
                <View style={[st.track, !reminder && { backgroundColor: '#D5DBE7' }]}>
                  <View style={[st.knob, reminder ? { right: 3 } : { left: 3 }]} />
                </View>
              </Pressable>
            </View>
          )}

          <Txt f="bodyHeavy" size={13} color="#4A5468" style={st.section}>
            Har yakshanba · oʻtgan bonuslar
          </Txt>

          {past.map((b, k) => {
            const seen = watched(b.id);
            if (!seen && k === 0) {
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.number}-bonus darsni koʻrish`}
                  onPress={() => open(b.id)}
                  style={({ pressed }) => [st.current, pressed && st.pressed]}
                >
                  <View style={st.play}>
                    <PlayIcon />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Txt f="bodyHeavy" size={15} numberOfLines={1}>
                      {b.number}-bonus · {b.category.label}
                    </Txt>
                    <Txt f="bodyBold" size={13} color="#9A3D00">
                      {short(b.date)} · hali koʻrish mumkin
                    </Txt>
                  </View>
                  <ChevronRight color="#9A3D00" />
                </Pressable>
              );
            }
            return (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => open(b.id)} style={({ pressed }) => [st.row, pressed && st.pressed]}>
                <View style={[st.dot, !seen && { backgroundColor: '#FFF1E6' }]}>
                  {seen ? <Check size={15} color="#087A4A" /> : <PlayIcon size={14} color="#FF7A1A" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt f="bodyHeavy" size={14}>
                    {b.number}-bonus dars
                  </Txt>
                  <Txt f="body" size={12} color="#4A5468">
                    {seen ? short(b.date) : `${short(b.date)} · hali koʻrish mumkin`}
                  </Txt>
                </View>
                {seen && (
                  <Txt f="bodyHeavy" size={12} color="#075E3A" style={{ flexShrink: 0 }}>
                    Koʻrildi ✓
                  </Txt>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <LessonsNav />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  pressed: { opacity: 0.85 },
  hero: { backgroundColor: '#7C4DFF', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, overflow: 'hidden', gap: 8 },
  heroImg: { position: 'absolute', right: 2, top: 6, width: 116, height: 104 },
  chip: { alignSelf: 'flex-start', letterSpacing: 0.88, textTransform: 'uppercase', backgroundColor: '#FFFFFF', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 9, overflow: 'hidden' },
  remind: { height: 52, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 10, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#7C4DFF', flexShrink: 0 },
  knob: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  section: { textTransform: 'uppercase', letterSpacing: 0.78, paddingTop: 4, paddingHorizontal: 2 },
  current: { backgroundColor: '#FFF1E6', borderRadius: 18, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 8, paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
