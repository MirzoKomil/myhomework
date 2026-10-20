/**
 * Kompyuter: Kurs muddati tugadi (dizayn: D_Expired).
 *
 * Ma'lumot mobil ekran (app/v2/kurs-tugadi.tsx) bilan bir xil: kurs nomi —
 * fetchMobileContent, muddat — kurs boshlanishi (fetchDemoStudentPayments)
 * + 3 oy, oldingi tarif — lessonDuration, menejer — fetchDemoStudentProfile.
 * Har bir tarif va pastki tugma menejer Telegramiga olib boradi.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { courseEnd, dm, dmy, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentPayments, fetchDemoStudentProfile, fetchMobileContent, type DemoPaymentsResponse } from '@/services/contentApi';

import { CalendarIcon, CheckIcon, ChevronIcon, H, LockIcon, Over, PPage, ShieldIcon, T, TgIcon, UnlockIcon } from './ui';

const TARIFFS = [
  { name: 'Start', minutes: 15 },
  { name: 'Standard', minutes: 30 },
  { name: 'VIP', minutes: 60 },
];
const OPEN = ['Natija, sertifikat', 'Lugʻat, oʻyinlar', 'Tarjimon'];
const CLOSED = ['Yangi darslar', 'Jonli darslar', 'Vazifa, imtihon'];

export function DExpired() {
  const { courseLang } = useLang();
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');

  useEffect(() => {
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchMobileContent()
      .then((mc) => setCourseName(mc.courses[0]?.name ?? ''))
      .catch(() => {});
    fetchDemoStudentProfile()
      .then((p) => setManagerPhone(p?.salesManagerPhone ?? ''))
      .catch(() => {});
  }, []);

  const managerUrl = tgByPhone(managerPhone, supportUrl(courseLang));
  const open = () => Linking.openURL(managerUrl).catch(() => {});
  const start = parseIso(pay?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const course = courseName ? `«${courseName}»` : '';

  return (
    <PPage title="Kurs muddati" subtitle={course} back={R.payments}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={s.hero}>
          <View style={s.date}>
            <CalendarIcon size={16} color="#B42318" sw={2.2} />
            <T size={14} color="#B42318">
              {end ? dmy(end) : ''}
            </T>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <Image source={designImages['68633deaacf537e7e92265a39c0e0949']} accessibilityLabel="Qum soatli Domik" style={{ width: 290, height: 290, marginBottom: -4 }} resizeMode="contain" />
            <H size={34} role="header" style={{ textAlign: 'center' }}>
              Kurs muddati tugadi
            </H>
            <T f="body" size={16} color="#4A5468" style={{ textAlign: 'center' }}>
              {[course, start && end ? `${dm(start)} – ${dmy(end)}` : ''].filter(Boolean).join(' · ')}
            </T>
          </View>
          <View style={s.safe}>
            <ShieldIcon size={22} color="#087A4A" sw={2.2} />
            <T size={15} color="#075E3A" style={{ flex: 1 }}>
              Natijalaringiz, coin va chaqmoqlaringiz saqlanadi
            </T>
          </View>
        </View>

        <View style={{ flex: 7, minWidth: 0, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
              <T size={18} lh={22.5} accessibilityRole="header">
                Davom ettirish uchun tarif
              </T>
              <T f="bodyBold" size={14} color="#4A5468">
                Narxni menejer aytadi
              </T>
            </View>
            <View style={s.list}>
              {TARIFFS.map((t, i) => {
                const prev = t.minutes === pay?.lessonDuration;
                return (
                  <Pressable key={t.name} accessibilityRole="link" onPress={open} style={[s.row, i < TARIFFS.length - 1 && s.rowBorder]}>
                    <View style={[s.num, prev && { backgroundColor: '#2F5BFF' }]}>
                      <T size={16} color={prev ? '#FFFFFF' : '#34405A'}>
                        {t.minutes}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T size={17}>{t.name}</T>
                        {prev && (
                          <View style={s.prev}>
                            <T size={12} color="#1E3FD1">
                              Oldingi tarifingiz
                            </T>
                          </View>
                        )}
                      </View>
                      <T f="body" size={14} color="#4A5468">{`${t.minutes} daqiqalik jonli darslar`}</T>
                    </View>
                    <TgIcon size={18} color="#1B8BC9" />
                    <ChevronIcon />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
            <Access title="Ochiq qoladi" color="#075E3A" bg="#E3F7EE" head={<UnlockIcon size={20} color="#087A4A" sw={2.1} />} items={OPEN} icon={<CheckIcon size={18} color="#087A4A" sw={2.1} />} />
            <Access title="Yopiladi" color="#B42318" bg="#FDECEC" head={<LockIcon size={20} color="#B42318" sw={2.1} />} items={CLOSED} icon={<LockIcon size={18} color="#B42318" sw={2.1} />} />
          </View>

          <Pressable accessibilityRole="link" onPress={open} style={s.cta}>
            <TgIcon size={20} />
            <T size={16}>Menejer bilan bogʻlanish</T>
          </Pressable>
        </View>
      </View>
    </PPage>
  );
}

function Access({ title, color, bg, head, items, icon }: { title: string; color: string; bg: string; head: React.ReactNode; items: string[]; icon: React.ReactNode }) {
  return (
    <View style={s.acc}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[s.accHead, { backgroundColor: bg }]}>{head}</View>
        <Over color={color}>{title}</Over>
      </View>
      <View accessibilityRole="list" style={{ flex: 1, gap: 10 }}>
        {items.map((t) => (
          <View key={t} style={s.li}>
            <View style={[s.liIcon, { backgroundColor: bg }]}>{icon}</View>
            <T size={16}>{t}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flex: 5, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, alignItems: 'center', gap: 14 },
  date: { alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FDECEC', flexDirection: 'row', alignItems: 'center', gap: 6 },
  safe: { width: '100%', backgroundColor: '#E3F7EE', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden' },
  row: { minHeight: 84, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  num: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  prev: { height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#E8EEFF', justifyContent: 'center' },
  acc: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 14 },
  accHead: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  li: { flex: 1, maxHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F9FC', borderRadius: 16, paddingHorizontal: 14 },
  liIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cta: { height: 58, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});
