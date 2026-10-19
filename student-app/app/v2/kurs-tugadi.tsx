/**
 * v2 Kurs muddati tugadi (dizayn: Expired.dc.html).
 *
 * Kurs nomi — fetchMobileContent, muddat — kurs boshlangan sana
 * (fetchDemoStudentPayments) + 3 oy, oldingi tarif — lessonDuration.
 * Narxni menejer aytadi — har bir tarif menejer Telegramiga olib boradi.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronIcon, CloseIcon, LockIcon3, ShieldCheckIcon, TelegramIcon2 } from '@/components/v2/profile/icons';
import { Column, courseEnd, dm, dmy, goBack, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentPayments, fetchDemoStudentProfile, fetchMobileContent, type DemoPaymentsResponse } from '@/services/contentApi';

const TARIFFS = [
  { name: 'Start', minutes: 15 },
  { name: 'Standard', minutes: 30 },
  { name: 'VIP', minutes: 60 },
];

export default function V2Expired() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');

  useEffect(() => {
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
    fetchDemoStudentProfile().then((p) => setManagerPhone(p?.salesManagerPhone ?? '')).catch(() => {});
  }, []);

  const managerUrl = tgByPhone(managerPhone, supportUrl(courseLang));
  const open = () => Linking.openURL(managerUrl).catch(() => {});
  const start = parseIso(pay?.courseStartDate);
  const end = start ? courseEnd(start) : null;

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: Math.max(26, insets.bottom + 14) }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.top}>
            <View style={st.date}><Text style={st.dateText}>{end ? dmy(end) : ''}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => goBack(R.payments)} style={st.close}>
              <CloseIcon />
            </Pressable>
          </View>
          <View style={st.body}>
            <View style={st.hero}>
              <Image source={designImages['68633deaacf537e7e92265a39c0e0949']} accessibilityLabel="Qum soatli Domik" style={st.mascot} resizeMode="contain" />
              <Text accessibilityRole="header" style={st.title}>Kurs muddati tugadi</Text>
              <Text style={st.sub}>
                {[courseName ? `«${courseName}»` : '', start && end ? `${dm(start)} – ${dmy(end)}` : ''].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={st.safe}>
              <ShieldCheckIcon />
              <Text style={st.safeText}>Natijalaringiz, coin va chaqmoqlaringiz saqlanadi</Text>
            </View>
            <View style={st.tHead}>
              <Text style={st.tTitle}>Davom ettirish uchun tarif</Text>
              <Text style={st.tNote}>Narxni menejer aytadi</Text>
            </View>
            <View style={st.list}>
              {TARIFFS.map((t, i) => {
                const prev = t.minutes === pay?.lessonDuration;
                return (
                  <Pressable key={t.name} accessibilityRole="link" onPress={open} style={({ pressed }) => [st.row, i < TARIFFS.length - 1 && st.rowBorder, pressed && st.pressed]}>
                    <View style={[st.num, prev && { backgroundColor: '#2F5BFF' }]}>
                      <Text style={[st.numText, prev && { color: '#FFFFFF' }]}>{t.minutes}</Text>
                    </View>
                    <View style={st.rowText}>
                      <View style={st.nameRow}>
                        <Text style={st.name}>{t.name}</Text>
                        {prev && <View style={st.prev}><Text style={st.prevText}>Oldingi tarifingiz</Text></View>}
                      </View>
                      <Text style={st.desc}>{`${t.minutes} daqiqalik jonli darslar`}</Text>
                    </View>
                    <ChevronIcon />
                  </Pressable>
                );
              })}
            </View>
            {/* Kurs tugagach nima ochiq qoladi / nima yopiladi */}
            <View style={st.access}>
              <View style={st.accCol}>
                <Text style={[st.accTitle, { color: '#075E3A' }]}>Ochiq qoladi</Text>
                <View style={st.accList}>
                  {['Natija, sertifikat', 'Lugʻat, oʻyinlar', 'Tarjimon'].map((t) => (
                    <View key={t} style={st.accItem}>
                      <CheckIcon size={16} color="#087A4A" strokeWidth={2.6} />
                      <Text style={st.accText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={st.accDivider} />
              <View style={st.accCol}>
                <Text style={[st.accTitle, { color: '#B42318' }]}>Yopiladi</Text>
                <View style={st.accList}>
                  {['Yangi darslar', 'Jonli darslar', 'Vazifa, imtihon'].map((t) => (
                    <View key={t} style={st.accItem}>
                      <LockIcon3 />
                      <Text style={st.accText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ height: 6 }} />
            <Pressable accessibilityRole="link" onPress={open} style={({ pressed }) => [st.cta, pressed && st.pressed]}>
              <TelegramIcon2 />
              <Text style={st.ctaText}>Menejer bilan bogʻlanish</Text>
            </Pressable>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  col: { flexGrow: 1 },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  dateText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 12 },
  hero: { alignItems: 'center', gap: 6 },
  mascot: { width: 118, height: 124 },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 28, lineHeight: 30.8, letterSpacing: -0.56, textAlign: 'center', color: '#0B1220' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20.3, textAlign: 'center', color: '#4A5468' },
  safe: { backgroundColor: '#E3F7EE', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  safeText: { flex: 1, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, lineHeight: 19.6, color: '#075E3A' },
  tHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 2, paddingHorizontal: 2 },
  tTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
  tNote: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  list: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  num: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  prev: { height: 22, paddingHorizontal: 8, marginLeft: 4, borderRadius: 11, backgroundColor: '#E8EEFF', justifyContent: 'center' },
  prevText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#1E3FD1' },
  desc: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  access: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 12 },
  accCol: { flex: 1, minWidth: 0, gap: 8 },
  accTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.72, textTransform: 'uppercase' },
  accList: { gap: 7 },
  accItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accText: { flexShrink: 1, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#0B1220' },
  accDivider: { width: 1, backgroundColor: '#EEF1F7' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
});
