/**
 * Kompyuter: To'lovlar va tarif (dizayn: D_Payments).
 *
 * Ma'lumot mobil ekran (app/v2/tolovlar.tsx) bilan bir xil:
 * fetchDemoStudentPayments (tarif, davomiylik, kurs boshlanishi, qarz,
 * muddat, to'lov tarixi), menejer — fetchDemoStudentProfile, shartnoma
 * raqami — fetchDemoContract, PDF hajmi — PDF faylning o'zidan. Kurs narxi =
 * to'langan + qarz; kurs 72 dars · 3 oy. "Qarzni to'lash" — DebtReminder
 * oynasi (?popup=debt bilan to'g'ridan-to'g'ri ochiladi).
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { DebtReminderPopup } from '@/components/v2/popups/DebtReminder';
import { fetchContractPdfInfo, formatSize } from '@/components/v2/profile/contract';
import { courseEnd, daysBetween, dm, dmy, methodLabel, money, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { COURSE_TOTAL_LESSONS } from '@/data/certificates';
import { useLang } from '@/i18n/LanguageContext';
import {
  fetchDemoContract,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  type DemoPaymentsResponse,
  type DemoProfileResponse,
} from '@/services/contentApi';

import { ArrowRightIcon, CheckIcon, ChevronIcon, ClockIcon, DocIcon, go, H, Over, PPage, T, TgIcon } from './ui';

const TARIFFS = [
  { name: 'Start', minutes: 15 },
  { name: 'Standard', minutes: 30 },
  { name: 'VIP', minutes: 60 },
];

export function DPayments() {
  const { courseLang } = useLang();
  const [p, setP] = useState<DemoPaymentsResponse | null>(null);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [contractNo, setContractNo] = useState('');
  const [pdf, setPdf] = useState('');
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [debtOpen, setDebtOpen] = useState(popup === 'debt');

  useEffect(() => {
    fetchDemoStudentPayments().then(setP).catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoContract()
      .then((c) => setContractNo(c?.number ?? ''))
      .catch(() => {});
    fetchContractPdfInfo().then((i) => i && setPdf(formatSize(i.bytes)));
  }, []);

  const managerUrl = tgByPhone(profile?.salesManagerPhone ?? '', supportUrl(courseLang));
  const start = parseIso(p?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const now = new Date();
  const daysLeft = end ? Math.max(0, daysBetween(now, end)) : 0;
  const timeRatio = start && end ? Math.min(1, Math.max(0, daysBetween(start, now) / Math.max(1, daysBetween(start, end)))) : 0;

  const history = p?.history ?? [];
  const paid = history.reduce((sum, h) => sum + (Number(h.paid) || 0), 0);
  const debt = p?.debtAmount ?? 0;
  const price = paid + debt;
  const last = history[0] as ((typeof history)[number] & { method?: string }) | undefined;
  const lastDate = parseIso(last?.date);
  const lastMethod = methodLabel(last?.method);
  const paidRatio = price > 0 ? paid / price : 0;
  const due = parseIso(p?.paymentDueDate);
  const dueLeft = due ? daysBetween(now, due) : null;
  const duration = p?.lessonDuration ?? 0;
  const leftText = dueLeft !== null && dueLeft >= 0 ? `${dueLeft} kun qoldi` : '';
  const subtitle = [p?.tariffLabel ?? '', start && end ? `${dm(start)} – ${dmy(end)}` : ''].filter(Boolean).join(' · ');

  return (
    <PPage title="Toʻlovlar va tarif" subtitle={subtitle} back={R.profile}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 7, minWidth: 0, gap: 20 }}>
          {/* Tarif kartasi */}
          <View style={s.hero}>
            <View style={s.heroBlob} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Over color="#FFFFFF">Tarifingiz</Over>
                <H size={40} lh={1.05} color="#FFFFFF">
                  {p?.tariffLabel ?? ''}
                </H>
                <T f="bodyBold" size={15} color="#FFFFFF">
                  {duration ? `${duration} daqiqalik jonli darslar` : ''}
                </T>
              </View>
              <View style={s.left}>
                <H size={30} lh={1} color="#1E3FD1">{`${daysLeft} kun`}</H>
                <T size={13} color="#1E3FD1">
                  qoldi
                </T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[`${COURSE_TOTAL_LESSONS} dars`, '3 oy', 'Haftada 3 jonli + 3 video'].map((c) => (
                <View key={c} style={s.chip}>
                  <T size={14} color="#FFFFFF">
                    {c}
                  </T>
                </View>
              ))}
            </View>
            <View style={s.heroTrack}>
              <View style={[s.heroFill, { width: `${Math.round(timeRatio * 100)}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T size={14} color="#FFFFFF">
                {start ? `Boshlangan ${dmy(start)}` : ''}
              </T>
              <T size={14} color="#FFFFFF">
                {end ? `Tugaydi ${dmy(end)}` : ''}
              </T>
            </View>
          </View>

          {/* Kurs narxi va to'lovlar */}
          <View style={s.bill}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T f="bodyBold" size={16} color="#34405A">
                Kurs narxi
              </T>
              <H size={26} ls={-0.01}>{`${money(price)} soʻm`}</H>
            </View>
            <View style={s.billTrack}>
              <View style={[s.billFill, { width: `${Math.round(paidRatio * 100)}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T size={14} color="#087A4A">{`${money(paid)} soʻm toʻlangan`}</T>
              {debt > 0 && <T size={14} color="#B34700">{`${money(debt)} soʻm qoldi`}</T>}
            </View>
            <View style={{ marginTop: 4 }}>
              {paid > 0 && (
                <PayRow
                  icon={<CheckIcon size={19} color="#087A4A" sw={2.1} />}
                  bg="#E3F7EE"
                  title="Toʻlangan"
                  sub={lastDate ? `${dmy(lastDate)}${lastMethod ? ` · ${lastMethod}` : ''}` : ''}
                  amount={`${money(paid)} soʻm`}
                  note="Toʻlandi"
                  noteColor="#087A4A"
                />
              )}
              {debt > 0 && (
                <PayRow
                  icon={<ClockIcon size={19} color="#B34700" sw={2.1} />}
                  bg="#FFF1E6"
                  title="Qolgan toʻlov"
                  sub={due ? `Muddat ${dmy(due)}` : ''}
                  amount={`${money(debt)} soʻm`}
                  note={leftText}
                  noteColor="#B34700"
                />
              )}
            </View>
            {debt > 0 && (
              <View style={s.debt}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Over color="#B34700">Qarzdorlik</Over>
                  <H size={32} color="#B42318">{`${money(debt)} soʻm`}</H>
                  <T size={14} color="#B34700">
                    {[due ? `Muddat ${dmy(due)}` : '', leftText].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setDebtOpen(true)} style={s.payBtn}>
                  <T size={15} color="#FFFFFF" lines={1}>{`Qarzni toʻlash · ${money(debt)} soʻm`}</T>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={{ flex: 5, minWidth: 0, gap: 20 }}>
          <View style={s.tariffs}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Over>Tariflar</Over>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(managerUrl).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TgIcon size={15} color="#2F5BFF" />
                <T size={14} color="#2F5BFF">
                  Oʻzgartirish — menejer orqali
                </T>
              </Pressable>
            </View>
            {TARIFFS.map((t) => {
              const mine = t.minutes === duration;
              return (
                <View key={t.name} style={[s.tariff, mine && s.tariffMine]}>
                  <View style={[s.tNum, mine && { backgroundColor: '#2F5BFF' }]}>
                    <T size={16} color={mine ? '#FFFFFF' : '#34405A'}>
                      {t.minutes}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={16}>{t.name}</T>
                    <T f="bodyBold" size={13} color="#4A5468">{`${t.minutes} daqiqalik jonli darslar`}</T>
                  </View>
                  {mine && (
                    <View style={s.you}>
                      <CheckIcon size={14} color="#FFFFFF" sw={3} />
                      <T size={13} color="#FFFFFF">
                        Siz
                      </T>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={s.group}>
            <Pressable accessibilityRole="link" onPress={() => go(R.contract)} style={s.row}>
              <DocIcon size={21} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T f="bodyBold" size={15}>
                  Shartnoma
                </T>
                <T f="body" size={13} color="#4A5468">
                  {`${contractNo ? `№${contractNo} · ` : ''}elektron imzolangan`}
                </T>
              </View>
              <T size={14} color="#4A5468">
                {pdf ? `PDF · ${pdf}` : 'PDF'}
              </T>
              <ChevronIcon />
            </Pressable>
          </View>

          <Pressable accessibilityRole="link" onPress={() => go(R.expired)} style={s.more}>
            <Image source={designImages['68633deaacf537e7e92265a39c0e0949']} style={{ width: 150, height: 150, marginLeft: -8 }} resizeMode="contain" />
            <View style={{ flex: 1, gap: 8 }}>
              <H size={22} lh={1.15}>
                Kurs tugagach nima boʻladi?
              </H>
              <T f="body" size={14} color="#4A5468" lh={20.3}>
                Natijalaringiz, coin va chaqmoqlaringiz saqlanadi
              </T>
              <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <T size={14} color="#2F5BFF">
                  Batafsil
                </T>
                <ArrowRightIcon color="#2F5BFF" />
              </View>
            </View>
          </Pressable>
        </View>
      </View>
      <DebtReminderPopup
        visible={debtOpen}
        onClose={() => setDebtOpen(false)}
        data={p ? { debt, paid, total: price, dueDate: p.paymentDueDate, firstName: (profile?.name ?? '').split(' ')[0] ?? '', managerUrl } : null}
      />
    </PPage>
  );
}

function PayRow({ icon, bg, title, sub, amount, note, noteColor }: { icon: React.ReactNode; bg: string; title: string; sub: string; amount: string; note: string; noteColor: string }) {
  return (
    <View style={s.payRow}>
      <View style={[s.payIcon, { backgroundColor: bg }]}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <T size={15}>{title}</T>
        <T f="bodyBold" size={13} color="#4A5468">
          {sub}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 1 }}>
        <T size={16}>{amount}</T>
        <T size={13} color={noteColor}>
          {note}
        </T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: '#2F5BFF', borderRadius: 28, padding: 26, gap: 16 },
  heroBlob: { position: 'absolute', right: -70, top: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: '#3D67FF' },
  left: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'flex-end' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#1E3FD1', justifyContent: 'center' },
  heroTrack: { height: 8, borderRadius: 4, backgroundColor: '#1E3FD1', overflow: 'hidden' },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: '#FFC93C' },
  bill: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 26, gap: 14 },
  billTrack: { height: 10, borderRadius: 5, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  billFill: { height: 10, borderRadius: 5, backgroundColor: '#087A4A' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  payIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  debt: { marginTop: 'auto', backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 20, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  payBtn: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 17,
    backgroundColor: '#2F5BFF',
    boxShadow: '0 5px 0 #1E3FD1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tariffs: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, gap: 12 },
  tariff: { borderWidth: 2, borderColor: '#E4E8F0', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tariffMine: { borderColor: '#2F5BFF', backgroundColor: '#F3F6FF' },
  tNum: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  you: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  more: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 22, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 18 },
});
