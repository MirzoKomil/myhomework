/**
 * v2 Savol-javoblar (dizayn: 58 · FAQ).
 *
 * Avval dizayndagi savollar (matni aynan), so'ng eski FAQ ekranidagi
 * dizaynda yo'q savollar. Dizaynda faqat birinchi javob yozilgan — qolgan javoblar
 * boshqa dizayn ekranlaridagi matnlardan (Uyga vazifa, Do'kon, Streak,
 * To'lovlar, BotConnect) yig'ilgan.
 */
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronDownIcon, ChevronUpIcon } from '@/components/v2/settings/icons';
import { Column, ScreenHeader, SUPPORT_TELEGRAM_URL, TelegramButton } from '@/components/v2/settings/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

const FAQ: { q: string; a: string }[] = [
  // Dizayndagi savollar
  {
    q: 'Jonli dars qachon boʻladi?',
    a: 'Jonli darslar seshanba, payshanba va shanba kunlari soat 19:00 da Telegram guruhda oʻtadi. Standard tarifda dars 30 daqiqa. Havola 15 daqiqa oldin ilovada va @Domworkuz_bot da chiqadi.',
  },
  {
    q: 'Uyga vazifa qanday tekshiriladi?',
    a: 'Avtomatik tekshiriladi. Topshirganingizdan keyin natija darhol chiqadi va coin hisobingizga tushadi. Xatolar «Xatolar» roʻyxatiga qoʻshiladi — takrorlashda yana chiqadi.',
  },
  {
    q: 'Coin nima va nimaga sarflanadi?',
    a: 'Coin uyga vazifa (+60), yuzma-yuz oʻyin (+25) va doʻst taklifi (+100) uchun beriladi. Uni Domwork doʻkonida qoʻshimcha kitoblar va streak himoyasiga sarflaysiz.',
  },
  {
    q: 'Streak himoyasi qanday ishlaydi?',
    a: 'Dars qoldirgan kuni streak saqlanadi. Himoyani doʻkondan 150 coinga olasiz — faollik boʻlmagan kuni u avtomatik ishlaydi.',
  },
  {
    q: 'Tarif va toʻlov qanday boʻladi?',
    a: 'Tarifingiz, toʻlangan summa va qarzdorlik «Toʻlovlar va tarif» boʻlimida koʻrinadi. Tarifni oʻzgartirish — menejer orqali.',
  },
  {
    q: 'Telegram bot nima uchun kerak?',
    a: 'Muhim xabarlar Telegramga keladi — ilovani ochmasangiz ham hech narsani oʻtkazib yubormaysiz: dars eslatmalari, jonli darsga chaqiruv, baho va vazifa xabarlari.',
  },
  // Eski FAQ ekranidagi, dizaynda yo'q savollar (coin va to'lov savollari
  // dizayndagi savollar bilan bir xil bo'lgani uchun takrorlanmadi)
  {
    q: "Qanday o'quv materiallarini olaman?",
    a: "Myhomework.uz talabasi sifatida siz dars materiallarini bepul yuklab olishingiz va xohlagan vaqtda foydalanishingiz mumkin. Har bir darsdan so'ng ko'nikmalaringizni mashq qildiradigan testlar mavjud.",
  },
  {
    q: "Darsni o'tkazib yuborsam nima bo'ladi?",
    a: "Jadval bo'limida barcha darslaringiz va yozib olingan darslar ro'yxatini ko'rishingiz mumkin. Live darsni o'tkazib yuborsangiz, keyinroq yozuvini tomosha qilishingiz mumkin.",
  },
];

export default function V2Faq() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Column style={styles.fill}>
          <ScreenHeader title="Savol-javoblar" subtitle="Kurs va ilova haqida" fallback={R.settings} />
          <View style={styles.body}>
            {FAQ.map((item, i) => {
              const expanded = open === i;
              return (
                <View key={item.q} style={[styles.card, expanded && styles.cardOpen]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setOpen(expanded ? null : i)}
                    style={styles.question}
                  >
                    <Text style={styles.qText}>{item.q}</Text>
                    {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </Pressable>
                  {expanded && <Text style={styles.answer}>{item.a}</Text>}
                </View>
              );
            })}
            <View style={styles.fill} />
            <View style={styles.support}>
              <View style={styles.supportRow}>
                <Image
                  source={designImages['cc0d95446730f059d25d989e2c9845ad']}
                  resizeMode="contain"
                  style={styles.supportImg}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <View style={styles.supportTexts}>
                  <Text style={styles.supportTitle}>Javob topmadingizmi?</Text>
                  <Text style={styles.supportSub}>Support Telegramda odatda 15 daqiqada javob beradi</Text>
                </View>
              </View>
              <TelegramButton label="Supportga yozish" url={SUPPORT_TELEGRAM_URL} height={52} radius={16} fontSize={16} />
            </View>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  scroll: { flexGrow: 1 },
  fill: { flex: 1 },
  body: { flex: 1, paddingTop: 16, paddingHorizontal: 20, gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  cardOpen: Platform.OS === 'web'
    ? ({ boxShadow: 'inset 0 0 0 2px #C9D6FF' } as object)
    : { borderWidth: 2, borderColor: '#C9D6FF' },
  question: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qText: { flex: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  answer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontFamily: fonts.body,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5468',
  },
  support: { backgroundColor: '#0B1220', borderRadius: 24, padding: 16, gap: 14 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportImg: { width: 60, height: 60, marginVertical: -6, flexShrink: 0 },
  supportTexts: { flex: 1, minWidth: 0, gap: 2 },
  supportTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  supportSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#C3CAD9' },
});
