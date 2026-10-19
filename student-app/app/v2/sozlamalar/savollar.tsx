/**
 * v2 Savol-javoblar (dizayn: 58 · FAQ).
 *
 * Faqat dizayndagi 7 ta savol (matni aynan). Dizaynda faqat "Seriya
 * uzilsa..." javobi yozilgan — qolgan javoblar
 * boshqa dizayn ekranlaridagi matnlardan (Uyga vazifa, Do'kon, Streak,
 * To'lovlar, BotConnect) yig'ilgan. Dizayndagi ochiq savol — "Seriya
 * uzilsa..." — uning "Namunani koʻrish" havolasi StreakLost oynasini ochadi.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/v2/settings/icons';
import { Column, ScreenHeader, SUPPORT_TELEGRAM_URL, TelegramButton } from '@/components/v2/settings/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

const FAQ: { q: string; a: string; sample?: boolean }[] = [
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

export default function V2Faq() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(4); // dizayndagi kabi "Seriya uzilsa..." ochiq

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 34 }]}
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
                  {expanded && (
                    <View style={[styles.answerBox, { paddingBottom: item.sample ? 8 : 16 }]}>
                      <Text style={styles.answer}>{item.a}</Text>
                      {item.sample && (
                        <Pressable
                          accessibilityRole="link"
                          onPress={() => router.push(`${R.streak}?popup=lost` as Href)}
                          style={({ pressed }) => [styles.sampleLink, pressed && { opacity: 0.85 }]}
                        >
                          <Text style={styles.sampleText}>Namunani koʻrish</Text>
                          <ArrowRightIcon />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={styles.spacer} />
            <View style={styles.support}>
              <View style={styles.supportTexts}>
                <Text style={styles.supportTitle}>Javob topmadingizmi?</Text>
                <Text style={styles.supportSub}>Support Telegramda ~15 daqiqada javob beradi</Text>
              </View>
              <TelegramButton
                label="Yozish"
                accessibilityLabel="Supportga Telegramda yozish"
                url={SUPPORT_TELEGRAM_URL}
                height={48}
                radius={14}
                fontSize={14}
                gap={6}
              />
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
  body: { flex: 1, paddingTop: 14, paddingHorizontal: 20, gap: 6 },
  card: { flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  cardOpen: Platform.OS === 'web'
    ? ({ boxShadow: 'inset 0 0 0 2px #C9D6FF' } as object)
    : { borderWidth: 2, borderColor: '#C9D6FF' },
  question: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qText: { flex: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  answerBox: { paddingHorizontal: 16, gap: 2 },
  answer: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20.3, color: '#4A5468' },
  sampleLink: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sampleText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 20, color: '#1E3FD1' },
  spacer: { height: 6, flexShrink: 0 },
  support: {
    flexShrink: 0,
    backgroundColor: '#0B1220',
    borderRadius: 22,
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportTexts: { flex: 1, minWidth: 0, gap: 1 },
  supportTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20.5, color: '#FFFFFF' },
  supportSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 17, color: '#C3CAD9' },
});
