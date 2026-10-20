/**
 * Kompyuter: Savol-javoblar (dizayn: D_FAQ).
 *
 * Savol/javoblar va mantiq mobil ekran (app/v2/sozlamalar/savollar.tsx)
 * bilan aynan bir xil: 7 ta savol, jonli dars javobi — haqiqiy jadval va
 * tarif (fetchDemoSchedule, fetchDemoStudentPayments), coin javobi — v2
 * mukofot konstantalaridan, "Seriya uzilsa..." ochiq va "Namunani koʻrish"
 * StreakLost oynasini shu ekran ustida ochadi (?popup=lost).
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { StreakLostPopup } from '@/components/v2/popups/StreakLost';
import { SUPPORT_TELEGRAM_URL } from '@/components/v2/settings/parts';
import { V2_BATTLE_DAILY_COIN_WINS, V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { fetchDemoSchedule, fetchDemoStudentPayments, type DemoPaymentsResponse, type DemoScheduleResponse } from '@/services/contentApi';

import { SettingsLayout } from './settingsNav';
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, T, TgIcon } from './ui';

const PATTERN_DAYS: Record<'mwf' | 'tts', string> = {
  mwf: 'dushanba, chorshanba va juma',
  tts: 'seshanba, payshanba va shanba',
};

/** Jonli dars javobi — faqat mavjud ma'lumotdan; yo'q bo'lsa raqamsiz (mobil bilan bir xil). */
function liveAnswer(sc: DemoScheduleResponse | null, pay: DemoPaymentsResponse | null) {
  const time = sc?.lessonTime ? /^\d{1,2}:\d{2}/.exec(sc.lessonTime)?.[0] ?? '' : '';
  const when = sc ? `${PATTERN_DAYS[sc.schedulePattern]} kunlari${time ? ` soat ${time} da` : ''}` : 'guruhingiz jadvali boʻyicha';
  const dur = pay?.lessonDuration ? ` ${pay.tariffLabel} tarifingizda dars ${pay.lessonDuration} daqiqa.` : '';
  return `Jonli darslar ${when} Telegram guruhda oʻtadi.${dur} Havola 15 daqiqa oldin ilovada va @Domworkuz_bot da chiqadi.`;
}

const FAQ: { q: string; a: string; sample?: boolean }[] = [
  { q: 'Jonli dars qachon boʻladi?', a: liveAnswer(null, null) },
  {
    q: 'Uyga vazifa qanday tekshiriladi?',
    a: 'Avtomatik tekshiriladi. Topshirganingizdan keyin natija darhol chiqadi va coin hisobingizga tushadi. Xatolar «Xatolar» roʻyxatiga qoʻshiladi — takrorlashda yana chiqadi.',
  },
  {
    q: 'Coin nima va nimaga sarflanadi?',
    a: `Coin uyga vazifadagi har bir toʻgʻri javob uchun (+1) va yuzma-yuz oʻyindagi gʻalaba uchun (+${V2_BATTLE_WIN_COINS}, kuniga birinchi ${V2_BATTLE_DAILY_COIN_WINS} ta gʻalaba) beriladi. Uni Domwork doʻkonida qoʻshimcha kitoblar va streak himoyasiga sarflaysiz.`,
  },
  {
    q: 'Streak himoyasi qanday ishlaydi?',
    a: 'Dars qoldirgan kuni streak saqlanadi. Himoyani doʻkondan 150 coinga olasiz — faollik boʻlmagan kuni u avtomatik ishlaydi.',
  },
  {
    q: 'Seriya uzilsa nima boʻladi?',
    a: 'Seriya 0 kundan qayta boshlanadi. Chaqmoq, coin va daraja saqlanib qoladi. Faol streak himoyasi boʻlsa, bir kun oʻtkazib yuborilsa ham seriya uzilmaydi.',
    sample: true,
  },
  {
    q: 'Tarif va toʻlov qanday boʻladi?',
    a: 'Tarifingiz, toʻlangan summa va qarzdorlik «Toʻlovlar va tarif» boʻlimida koʻrinadi. Tarifni oʻzgartirish — menejer orqali.',
  },
  {
    q: 'Telegram bot nima uchun kerak?',
    a: 'Muhim xabarlar Telegramga keladi — ilovani ochmasangiz ham hech narsani oʻtkazib yubormaysiz: dars eslatmalari, jonli darsga chaqiruv, baho va vazifa xabarlari.',
  },
];

export function DFaq() {
  const [open, setOpen] = useState<number | null>(4); // dizayndagi kabi "Seriya uzilsa..." ochiq
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [lostOpen, setLostOpen] = useState(popup === 'lost');
  const [live, setLive] = useState(FAQ[0].a);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDemoSchedule().catch(() => null), fetchDemoStudentPayments().catch(() => null)]).then(([sc, pay]) => {
      if (!cancelled) setLive(liveAnswer(sc, pay));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsLayout active="faq" title="Savol-javoblar" subtitle="Kurs va ilova haqida">
      <View style={{ gap: 10 }}>
        {FAQ.map((item, i) => {
          const expanded = open === i;
          return (
            <View key={item.q} style={[s.card, expanded && { boxShadow: 'inset 0 0 0 2px #BCCBFF' }]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : i)} style={s.q}>
                <View style={[s.num, expanded && { backgroundColor: '#2F5BFF' }]}>
                  <T size={13} color={expanded ? '#FFFFFF' : '#34405A'}>
                    {i + 1}
                  </T>
                </View>
                <T size={15} style={{ flex: 1 }}>
                  {item.q}
                </T>
                {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Pressable>
              {expanded && (
                <View style={s.a}>
                  <T f="body" size={15} color="#34405A" lh={23.25}>
                    {i === 0 ? live : item.a}
                  </T>
                  {item.sample && (
                    <Pressable accessibilityRole="link" onPress={() => setLostOpen(true)} style={s.sample}>
                      <T size={14} color="#1E3FD1">
                        Namunani koʻrish
                      </T>
                      <ArrowRightIcon />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
      <View style={s.support}>
        <Image source={designImages.cc0d95446730f059d25d989e2c9845ad} style={{ width: 64, height: 64 }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 3 }}>
          <T size={17} color="#FFFFFF">
            Javob topmadingizmi?
          </T>
          <T f="body" size={14} color="#C9D1E0">
            Support Telegramda ~15 daqiqada javob beradi
          </T>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Supportga Telegramda yozish" onPress={() => Linking.openURL(SUPPORT_TELEGRAM_URL).catch(() => {})} style={s.tg}>
          <TgIcon size={18} />
          <T size={15}>Yozish</T>
        </Pressable>
      </View>
      <StreakLostPopup visible={lostOpen} onClose={() => setLostOpen(false)} />
    </SettingsLayout>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18 },
  q: { minHeight: 66, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  a: { paddingHorizontal: 22, paddingBottom: 20, gap: 14 },
  sample: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  support: { marginTop: 'auto', backgroundColor: '#0B1220', borderRadius: 24, paddingVertical: 16, paddingRight: 18, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  tg: { height: 50, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, flexShrink: 0 },
});
