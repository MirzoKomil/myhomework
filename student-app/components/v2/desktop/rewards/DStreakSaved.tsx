/**
 * Kompyuter: Seriya oynasi (dizayn: D_StreakSaved) — ochilgan sahifa ustida
 * markazdagi karta (marshrut transparentModal; karta Modal ichida, shuning
 * uchun chap menyu ham xiralashadi).
 *
 * Seriya — fetchMyProgress().streak (yon menyu va bosh sahifadagi bilan bir
 * xil qiymat). Oxirgi 7 kun: bugun — "seriya + 1", undan oldingi `seriya`
 * kun bajarilgan (ketma-ket). Streak himoyasi serverda yo'q — himoya
 * ishlatilgan kun va "Ishlatildi" qatori ko'rsatilmaydi, faol himoya yo'q.
 * "Darsni davom ettirish · 2 / 5" — mobil ekrandagi bilan bir xil joriy dars.
 * Klaviatura: Esc — yopish.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useShellInfo } from '@/components/v2/desktop/shellData';
import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { currentStep as firstOpenStep, lessonSteps, useListened } from '@/components/v2/lessons/data';
import { StreakLostPopup } from '@/components/v2/popups/StreakLost';
import { goBack } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';

import { CloseBtn, DButton, DPopup, ICheck, IChevron, IShield, T } from './ui';

const SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const SHIELD_PRICE = 150;

export function DStreakSaved() {
  const { streak } = useShellInfo();
  const params = useLocalSearchParams<{ popup?: string }>();
  // ?popup=lost — "Seriya uzildi" namuna oynasi (FAQ'dan; mobil kabi).
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (params.popup === 'lost') setLost(true);
  }, [params.popup]);
  const [lesson, setLesson] = useState<CurrentLesson | null>(null);
  const listened = useListened(lesson?.id ?? '');

  useEffect(() => {
    resolveCurrentLesson()
      .then(setLesson)
      .catch(() => {});
  }, []);

  const close = () => goBack(R.home);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  const steps = lesson
    ? lessonSteps({ id: lesson.id, isVideo: lesson.isVideoDay, content: lesson.content }, lesson.trackIds.length, listened.filter((x) => lesson.trackIds.includes(x)).length)
    : [];
  const total = steps.length;
  const current = Math.min(firstOpenStep(steps) + 1, total);

  return (
    <>
      <DPopup visible={!lost} onClose={close} width={540} label="Seriya">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <View style={s.art}>
            <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 110, height: 110 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T f="display" size={34} lh={37} accessibilityRole="header" style={{ letterSpacing: -0.68 }}>
              Seriya:{' '}
              <T f="display" size={34} color="#B34700">
                {streak} kun
              </T>
            </T>
            <T size={16} color="#4A5468">
              Bugun darsni tugatsangiz —{' '}
              <T f="bodyHeavy" size={16}>
                {streak + 1} kun
              </T>
              .
            </T>
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <CloseBtn onPress={close} />
          </View>
        </View>

        <View accessible accessibilityLabel={`Oxirgi 7 kun: seriya ${streak} kun, bugun hali emas`} style={s.week}>
          {days.map((d, i) => {
            const isToday = i === 6;
            const done = !isToday && 6 - i <= streak;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                {isToday ? (
                  <View style={[s.circle, s.today]}>
                    <T f="bodyHeavy" size={17} color="#B34700">
                      {streak + 1}
                    </T>
                  </View>
                ) : done ? (
                  <View style={[s.circle, { backgroundColor: '#FF7A1A' }]}>
                    <ICheck size={20} color="#FFFFFF" sw={3} />
                  </View>
                ) : (
                  // Belgilanmagan kun — doira o'lchami, ichi bo'sh (mobil kabi).
                  <View style={s.circle} />
                )}
                <T f="bodyHeavy" size={13} color={isToday ? '#0B1220' : '#4A5468'}>
                  {isToday ? 'Bugun' : SHORT[d.getDay()]}
                </T>
              </View>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(R.shop as Href)}
          style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.shield, hovered && { backgroundColor: '#FAFBFD' }]}
        >
          <IShield size={22} color="#5B6478" sw={2.2} />
          <View style={{ flex: 1 }}>
            <T f="bodyHeavy" size={15}>
              Faol himoya yoʻq
            </T>
            <T size={14} color="#4A5468">
              Doʻkonda{' '}
              <T f="bodyBold" size={14}>
                {SHIELD_PRICE} coin
              </T>
            </T>
          </View>
          <IChevron />
        </Pressable>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 2,
          }}
        >
          <DButton
            label={total ? `Darsni davom ettirish · ${current} / ${total}` : 'Darsni davom ettirish'}
            height={54}
            onPress={() => router.push((lesson ? R.lesson(lesson.id) : R.path) as Href)}
          />
        </View>
      </DPopup>
      <StreakLostPopup
        visible={lost}
        onClose={() => {
          setLost(false);
          // Dizaynda "Yopish" FAQ'ga qaytaradi — oyna FAQ'dan ochilgan.
          goBack(R.faq);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  art: {
    width: 116,
    height: 116,
    borderRadius: 30,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: {
    backgroundColor: '#F4F6FA',
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 3, borderColor: '#FF7A1A', backgroundColor: '#FFFFFF' },
  shield: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E6EE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
