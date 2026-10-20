/**
 * Kompyuter: Bonus darslar (dizayn: D_Bonus.dc.html).
 *
 * Ma'lumot mobil Bonus ekrani bilan bir xil: bonus darslar ro'yxati va
 * sanalari — bonusData (BONUS_LESSONS, UNLOCKED_COUNT), "Ko'rildi" —
 * lessonProgressStore videoWatch, tugagan darslar — loadCourseData,
 * eslatma — shu qurilmadagi tanlov (useBonusReminder).
 * Bonus vaqti (soat) va bonus uchun coin serverda yo'q — soat
 * ko'rsatilmaydi, coin "+0".
 */
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { BONUS_LESSONS, short, TOTAL, UNLOCKED_COUNT, useBonusReminder, whenLabel } from '@/components/v2/homework/bonusData';
import { loadCourseData } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getLessonProgress, loadLessonProgress, subscribe } from '@/services/lessonProgressStore';

import { DesktopPage } from '../Shell';
import { go, IBell, ICheck, IChevron, ICoin, IPlay, LessonTabs, Over, PageTitle, T } from './ui';

export function DBonus() {
  const [, setTick] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [reminder, setReminder] = useBonusReminder();

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
  const open = (id: string) => go(R.bonusPlayer(id));

  return (
    <DesktopPage title="Darslar" titleSlot={<PageTitle title="Darslar" sub={done === null ? undefined : `${done} / 72 tugadi`} />} contentStyle={s.content}>
      <View style={s.topRow}>
        <LessonTabs active="bonus" />
        <T f="bodyBold" size={14} color="#4A5468">
          Har yakshanba · bonus dars
        </T>
      </View>

      <View style={s.body}>
        {next ? (
          <View style={s.hero}>
            <View accessibilityElementsHidden style={s.heroBlob} />
            <Image source={designImages['8c685006bea3b1898e962d7116efecbd']} accessibilityElementsHidden style={s.heroImg} resizeMode="contain" />
            <View style={s.heroChip}>
              <Over size={12} em={0.06} color="#6A3CF0">
                Keyingi bonus
              </Over>
            </View>
            <T f="display" size={38} lh={39.9} ls={-0.76} color="#FFFFFF" style={{ maxWidth: 380 }}>
              {next.category.label}
            </T>
            <T f="bodyBold" size={17} color="#FFFFFF">
              {whenLabel(next.date)}
            </T>
            <View style={{ flex: 1 }} />
            <View style={s.progRow}>
              <View style={s.progTrack}>
                <View style={[s.progFill, { width: `${(watchedCount / TOTAL) * 100}%` }]} />
              </View>
              <T size={15} color="#FFFFFF">
                {watchedCount} / {TOTAL} koʻrildi
              </T>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: reminder }}
              accessibilityLabel={`Eslatma: ${short(next.date)}`}
              onPress={() => setReminder(!reminder)}
              style={({ pressed }) => [s.remind, pressed && { opacity: 0.9 }]}
            >
              <IBell />
              <View style={{ flex: 1, gap: 1 }}>
                <T size={17} color="#6A3CF0">
                  Eslatma
                </T>
                <T f="bodyBold" size={14} color="#34405A">
                  30 daqiqa oldin · Telegram bot
                </T>
              </View>
              <View style={[s.track, !reminder && { backgroundColor: '#D5DBE7' }]}>
                <View style={[s.knob, reminder ? { right: 4 } : { left: 4 }]} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={s.side}>
          <View style={{ paddingVertical: 2, paddingHorizontal: 4 }}>
            <Over size={11} color="#34405A">
              Har yakshanba · oʻtgan bonuslar
            </Over>
          </View>
          {past.map((b, k) => {
            const seen = watched(b.id);
            if (!seen && k === 0) {
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${b.number}-bonus darsni koʻrish`}
                  onPress={() => open(b.id)}
                  style={({ pressed }) => [s.current, pressed && { opacity: 0.9 }]}
                >
                  <View style={s.play}>
                    <IPlay size={22} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T size={17} lines={1}>
                      {b.number}-bonus · {b.category.label}
                    </T>
                    <T f="bodyBold" size={14} color="#B34700">
                      {short(b.date)} · hali koʻrish mumkin
                    </T>
                  </View>
                  <IChevron size={18} color="#B34700" sw={2.6} />
                </Pressable>
              );
            }
            return (
              <Pressable key={b.id} accessibilityRole="link" onPress={() => open(b.id)} style={({ pressed }) => [s.row, pressed && { opacity: 0.9 }]}>
                <View style={[s.dot, !seen && { backgroundColor: '#FFF1E6' }]}>{seen ? <ICheck size={20} color="#087A4A" sw={2.8} /> : <IPlay size={18} color="#FF7A1A" />}</View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <T size={16}>{b.number}-bonus dars</T>
                  <T f="body" size={14} color="#4A5468">
                    {seen ? short(b.date) : `${short(b.date)} · hali koʻrish mumkin`}
                  </T>
                </View>
                {seen && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <T size={14} color="#075E3A">
                      Koʻrildi
                    </T>
                    <ICheck size={14} color="#075E3A" sw={2.8} />
                  </View>
                )}
              </Pressable>
            );
          })}
          <View style={s.reward}>
            <ICoin size={18} />
            <T f="bodyBold" size={14} color="#6B4800">
              Bonus dars (oxirigacha){' '}
              <T size={14} color="#7A5300">
                +0 coin
              </T>
            </T>
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
  hero: { position: 'relative', overflow: 'hidden', flex: 1, minWidth: 0, backgroundColor: '#7C4DFF', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 30, gap: 14 },
  heroBlob: { position: 'absolute', right: -90, top: 90, width: 520, height: 520, borderRadius: 260, backgroundColor: '#8F66FF' },
  heroImg: { position: 'absolute', right: 30, top: 150, width: 400, height: 380 },
  heroChip: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 14, maxWidth: 420 },
  progTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#9B7BFF' },
  progFill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  remind: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  track: { width: 56, height: 32, borderRadius: 16, backgroundColor: '#7C4DFF' },
  knob: { position: 'absolute', top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  side: { width: 440, flexShrink: 0, gap: 12 },
  current: { flex: 1, maxHeight: 112, backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 20, paddingRight: 20, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  play: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  row: { flex: 1, maxHeight: 104, backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 18, paddingRight: 20, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  dot: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reward: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF4D1', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
});
