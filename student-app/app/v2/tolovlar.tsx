/**
 * v2 To'lovlar va tarif (dizayn: Payments.dc.html).
 *
 * Ma'lumotlar eski profile/payment.tsx bilan bir xil: fetchDemoStudentPayments
 * (tarif, dars davomiyligi, kurs boshlangan sana, qarzdorlik, muddat, to'lov
 * tarixi) va shartnoma PDF'i. Kurs narxi = to'langan + qarz. Kurs 72 dars ·
 * 3 oy — tugash sanasi boshlanishdan 3 oy keyin. Tariflar ro'yxati CRM'dagi
 * (js/paymentLedger.js TARIFFS) bilan bir xil: Start 15, Standard 30, VIP 60.
 */
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DebtReminderPopup } from '@/components/v2/popups/DebtReminder';
import { fetchContractPdfInfo, formatSize } from '@/components/v2/profile/contract';
import { CheckIcon, ChevronIcon, DocIcon } from '@/components/v2/profile/icons';
import {
  Column,
  courseEnd,
  daysBetween,
  dmy,
  go,
  Header,
  methodLabel,
  money,
  parseIso,
  supportUrl,
  tgByPhone,
} from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { COURSE_TOTAL_LESSONS } from '@/data/certificates';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentPayments, fetchDemoStudentProfile, type DemoPaymentsResponse, type DemoProfileResponse } from '@/services/contentApi';

const TARIFFS = [
  { name: 'Start', minutes: 15 },
  { name: 'Standard', minutes: 30 },
  { name: 'VIP', minutes: 60 },
];

export default function V2Payments() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const [p, setP] = useState<DemoPaymentsResponse | null>(null);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [pdf, setPdf] = useState<string>('');
  const [debtOpen, setDebtOpen] = useState(false);

  useEffect(() => {
    fetchDemoStudentPayments().then(setP).catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
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
  const last = history[0] as (typeof history)[number] & { method?: string } | undefined;
  const lastDate = parseIso(last?.date);
  const lastMethod = methodLabel(last?.method);
  const paidRatio = price > 0 ? paid / price : 0;
  const due = parseIso(p?.paymentDueDate);
  const dueLeft = due ? daysBetween(now, due) : null;
  const duration = p?.lessonDuration ?? 0;

  return (
    <View style={st.screen}>
      <Header title="Toʻlovlar va tarif" fallback={R.profile} />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.hero}>
            <View style={st.heroTop}>
              <View style={{ gap: 1, flexShrink: 1 }}>
                <Text style={st.heroOver}>Tarifingiz</Text>
                <Text style={st.heroName}>{p?.tariffLabel ?? ''}</Text>
                <Text style={st.heroSub}>{duration ? `${duration} daqiqalik jonli darslar` : ''}</Text>
              </View>
              <View style={st.left}>
                <Text style={st.leftNum}>{`${daysLeft} kun`}</Text>
                <Text style={st.leftLabel}>qoldi</Text>
              </View>
            </View>
            <View style={st.chips}>
              {[`${COURSE_TOTAL_LESSONS} dars`, '3 oy', 'Haftada 3 jonli + 3 video'].map((c) => (
                <View key={c} style={st.chip}><Text style={st.chipText}>{c}</Text></View>
              ))}
            </View>
            <View style={st.heroTrack}><View style={[st.heroFill, { width: `${Math.round(timeRatio * 100)}%` }]} /></View>
            <View style={st.heroFoot}>
              <Text style={st.heroFootText}>{start ? `Boshlangan ${dmy(start)}` : ''}</Text>
              <Text style={st.heroFootText}>{end ? `Tugaydi ${dmy(end)}` : ''}</Text>
            </View>
          </View>

          <View style={st.bill}>
            <View style={st.billRow}>
              <Text style={st.billLabel}>Kurs narxi</Text>
              <Text style={st.billValue}>{`${money(price)} soʻm`}</Text>
            </View>
            <View style={st.billRow}>
              <View>
                <Text style={st.billLabel}>Toʻlangan</Text>
                {!!lastDate && <Text style={st.billSub}>{`${dmy(lastDate)}${lastMethod ? ` · ${lastMethod}` : ''}`}</Text>}
              </View>
              <Text style={[st.billValue, { color: '#087A4A' }]}>{`${money(paid)} soʻm`}</Text>
            </View>
            <View style={st.billTrack}><View style={[st.billFill, { width: `${Math.round(paidRatio * 100)}%` }]} /></View>
            {debt > 0 && (
              <View style={st.debt}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={st.debtOver}>Qarzdorlik</Text>
                  <Text style={st.debtAmount}>{`${money(debt)} soʻm`}</Text>
                  {!!due && <Text style={st.debtSub}>{`Muddat ${dmy(due)}`}</Text>}
                  {dueLeft !== null && dueLeft >= 0 && <Text style={st.debtSub}>{`${dueLeft} kun qoldi`}</Text>}
                </View>
                <Pressable accessibilityRole="button" onPress={() => setDebtOpen(true)} style={({ pressed }) => [st.payBtn, pressed && st.pressed]}>
                  <Text style={st.payText}>Qarzni toʻlash</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={st.tHead}>
            <Text style={st.tTitle}>Tariflar</Text>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(managerUrl).catch(() => {})} style={st.tLink}>
              <Text style={st.tLinkText}>Oʻzgartirish — menejer orqali</Text>
            </Pressable>
          </View>
          <View style={st.tariffs}>
            {TARIFFS.map((t) => {
              const mine = t.minutes === duration;
              return (
                <View key={t.name} style={[st.tariff, mine && st.tariffMine]}>
                  <Text style={st.tName}>{t.name}</Text>
                  <Text style={st.tMin}>{`${t.minutes} daq`}</Text>
                  {mine ? (
                    <View style={st.youRow}>
                      <CheckIcon size={12} color="#1E3FD1" strokeWidth={3.2} />
                      <Text style={st.you}>Siz</Text>
                    </View>
                  ) : (
                    <Text style={st.tNote}>jonli dars</Text>
                  )}
                </View>
              );
            })}
          </View>

          <View style={st.group}>
            <Pressable accessibilityRole="link" onPress={() => go(R.contract)} style={({ pressed }) => [st.row, pressed && st.pressed]}>
              <DocIcon />
              <Text style={st.rowLabel}>Shartnoma</Text>
              <Text style={st.rowValue}>{pdf ? `PDF · ${pdf}` : 'PDF'}</Text>
              <ChevronIcon />
            </Pressable>
          </View>

          <Pressable accessibilityRole="link" onPress={() => go(R.expired)} style={st.more}>
            <Text style={st.moreText}>Kurs tugagach nima boʻladi?</Text>
            <ChevronIcon size={16} color="#1E3FD1" />
          </Pressable>
        </Column>
      </ScrollView>
      <DebtReminderPopup
        visible={debtOpen}
        onClose={() => setDebtOpen(false)}
        data={p ? { debt, paid, total: price, dueDate: p.paymentDueDate, firstName: (profile?.name ?? '').split(' ')[0] ?? '', managerUrl } : null}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingTop: 14 },
  col: { gap: 10 },
  pressed: { opacity: 0.85 },
  hero: { backgroundColor: '#2F5BFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heroOver: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.72, textTransform: 'uppercase', color: '#FFFFFF' },
  heroName: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, lineHeight: 28.6, color: '#FFFFFF' },
  heroSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  left: { alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  leftNum: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 22, color: '#1E3FD1' },
  leftLabel: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#1E3FD1' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.16)', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#FFFFFF' },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: '#1E3FD1', overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: '#FFC93C' },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  heroFootText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  bill: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#4A5468' },
  billSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  billValue: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  billTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  billFill: { height: 6, borderRadius: 3, backgroundColor: '#087A4A' },
  debt: { backgroundColor: '#FFF1E6', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  debtOver: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.48, textTransform: 'uppercase', color: '#B42318' },
  debtAmount: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 23, color: '#B42318' },
  debtSub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#7A2E0E' },
  payBtn: { height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#D92D20', justifyContent: 'center', flexShrink: 0 },
  payText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#FFFFFF' },
  tHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  tTitle: { paddingLeft: 2, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#4A5468' },
  tLink: { height: 44, justifyContent: 'center' },
  tLinkText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#1E3FD1' },
  tariffs: { flexDirection: 'row', gap: 8 },
  tariff: { flex: 1, minWidth: 0, borderWidth: 2, borderColor: '#E4E8F0', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, gap: 1 },
  tariffMine: { borderColor: '#2F5BFF', backgroundColor: '#E8EEFF' },
  tName: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220' },
  tMin: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  tNote: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#5B6478' },
  youRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  you: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#1E3FD1' },
  group: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  rowValue: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  more: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  moreText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#1E3FD1' },
});
