/**
 * v2 Shartnoma (dizayn: Contract.dc.html).
 *
 * Shartnoma raqami/sanasi — fetchDemoContract (CRM biriktirgan, PDF bilan
 * bir xil), buyurtmachi — fetchDemoStudentProfile, tarif/narx/muddat/qarz —
 * fetchDemoStudentPayments, kurs nomi — fetchMobileContent. Betlar soni va
 * hajmi — PDF faylning o'zidan. "Toʻliq shartnoma (PDF)" — haqiqiy PDF
 * (getContractPdfUrl), ulashish — tizim ulashish oynasi (webda
 * navigator.share bo'lmasa havola nusxalanadi).
 */
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchContractPdfInfo, formatSize, type PdfInfo } from '@/components/v2/profile/contract';
import { CheckIcon, DownloadIcon, ShareIcon } from '@/components/v2/profile/icons';
import { Column, courseEnd, dmy, Header, money, parseIso } from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { COURSE_TOTAL_LESSONS } from '@/data/certificates';
import {
  fetchDemoContract,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  fetchMobileContent,
  getContractPdfUrl,
  type DemoContractResponse,
  type DemoPaymentsResponse,
  type DemoProfileResponse,
} from '@/services/contentApi';

// Shartnoma bo'limlari (PDF shabloni tartibida); 2 va 3 — yuqorida qisqacha berilgan.
const SECTIONS = [
  { label: '1 · Tomonlar', on: false },
  { label: '2 · Majburiyat', on: true },
  { label: '3 · Toʻlov', on: true },
  { label: '4 · Imzolar', on: false },
];

function Clause({ n, text }: { n: string; text: string }) {
  return (
    <View style={st.clause}>
      <View style={st.clauseNum}><Text style={st.clauseNumText}>{n}</Text></View>
      <Text style={st.clauseText}>{text}</Text>
    </View>
  );
}

export default function V2Contract() {
  const insets = useSafeAreaInsets();
  const [contract, setContract] = useState<DemoContractResponse | null>(null);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [pdf, setPdf] = useState<PdfInfo | null>(null);

  useEffect(() => {
    fetchDemoContract().then(setContract).catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
    fetchContractPdfInfo().then(setPdf);
  }, []);

  const pages = pdf?.pages ?? 0;
  const size = pdf ? formatSize(pdf.bytes) : '';
  const date = parseIso(contract?.date);
  const start = parseIso(pay?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const paid = (pay?.history ?? []).reduce((s, h) => s + (Number(h.paid) || 0), 0);
  const debt = pay?.debtAmount ?? 0;
  const price = paid + debt;
  const due = parseIso(pay?.paymentDueDate);

  const download = () => Linking.openURL(getContractPdfUrl()).catch(() => {});
  const share = async () => {
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? new URL(getContractPdfUrl(), window.location.href).href : getContractPdfUrl();
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
        if (nav.share) await nav.share({ title: 'Shartnoma', url });
        else await navigator.clipboard?.writeText(url);
      } else {
        await Share.share({ message: url, url });
      }
    } catch {
      // Foydalanuvchi bekor qildi.
    }
  };

  const rows = [
    { k: 'Kurs', v: courseName ? `«${courseName}»` : '' },
    { k: 'Tarif', v: pay ? `${pay.tariffLabel} · ${pay.lessonDuration} daqiqalik jonli dars` : '' },
    { k: 'Muddat', v: start && end ? `${dmy(start)} – ${dmy(end)}` : '' },
    { k: 'Narx', v: `${money(price)} soʻm` },
  ];

  return (
    <View style={st.screen}>
      <Header
        title="Shartnoma"
        subtitle={pdf ? `PDF · ${pages} bet · ${size}` : 'PDF'}
        fallback={R.payments}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[st.content, { paddingBottom: Math.max(26, insets.bottom + 12) }]}
        showsVerticalScrollIndicator={false}
      >
        <Column style={st.col}>
          <View accessibilityLabel="Shartnoma qisqacha" style={st.summary}>
            <View style={st.sTop}>
              <Text style={st.sPlace}>{['Andijon', date ? dmy(date) : ''].filter(Boolean).join(' · ')}</Text>
              <View style={st.signed}>
                <CheckIcon size={13} color="#075E3A" strokeWidth={3} />
                <Text style={st.signedText}>Elektron imzolangan</Text>
              </View>
            </View>
            <Text style={st.sTitle}>{`Shartnoma №${contract?.number ?? ''}`}</Text>
            <Text style={st.sSub}>
              {`Onlayn taʼlim xizmatlarini koʻrsatish haqida · Domwork MCHJ va ${profile?.name ?? ''}`}
            </Text>
            <View style={{ marginTop: 6 }}>
              {rows.map((r, i) => {
                const last = i === rows.length - 1;
                return (
                  <View key={r.k} style={[st.row, last ? st.rowLast : st.rowBorder]}>
                    <Text style={st.rowK}>{r.k}</Text>
                    <Text style={st.rowV}>{r.v}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={st.card}>
            <Text accessibilityRole="header" style={st.cardTitle}>Asosiy bandlar</Text>
            <View style={{ gap: 6 }}>
              <Text style={st.part}>2-boʻlim · Majburiyatlar</Text>
              <Clause n="2.1" text={`Ijrochi ${COURSE_TOTAL_LESSONS} ta darsni (videodars, jonli dars, uyga vazifa) ilova orqali 3 oy davomida taqdim etadi.`} />
              <Clause n="2.2" text="Buyurtmachi darslarda qatnashadi va toʻlovni oʻz vaqtida amalga oshiradi." />
              <Text style={[st.part, { marginTop: 3 }]}>3-boʻlim · Toʻlov</Text>
              <Clause
                n="3.1"
                text={`Qolgan summa — ${money(debt)} soʻm — ${due ? dmy(due) : '—'} gacha toʻlanadi (Click, Payme yoki naqd).`}
              />
            </View>
          </View>

          <View accessibilityLabel={`Shartnoma sahifalari: ${pages} bet`} style={st.pages}>
            {SECTIONS.map((p) => (
              <View key={p.label} style={st.pageCol}>
                <View style={[st.thumb, p.on && st.thumbOn]}>
                  <View style={[st.tl, { width: '70%', backgroundColor: '#B8C1D6' }]} />
                  <View style={[st.tl, { width: '100%' }]} />
                  <View style={[st.tl, { width: '85%' }]} />
                </View>
                <Text style={[st.pageLabel, p.on && { color: '#1E3FD1' }]}>{p.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }} />
          <View style={st.btns}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Toʻliq shartnomani yuklab olish, PDF${pdf ? `, ${pages} bet, ${size}` : ''}`}
              onPress={download}
              style={({ pressed }) => [st.dl, pressed && st.pressed]}
            >
              <DownloadIcon color="#1E3FD1" />
              <Text style={st.dlText} numberOfLines={1}>Toʻliq shartnoma (PDF)</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Ulashish" onPress={share} style={({ pressed }) => [st.shareBtn, pressed && st.pressed]}>
              <ShareIcon />
            </Pressable>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 14 },
  col: { flexGrow: 1, gap: 12 },
  pressed: { opacity: 0.85 },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, gap: 4 },
  sTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sPlace: { flexShrink: 1, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  signed: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 4 },
  signedText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#075E3A' },
  sTitle: { marginTop: 6, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, lineHeight: 24, color: '#0B1220' },
  sSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.2, color: '#4A5468' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowBorder: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowLast: { paddingTop: 7 },
  rowK: { flexShrink: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#4A5468' },
  rowV: { flexShrink: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220', textAlign: 'right' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18, gap: 8 },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#4A5468' },
  part: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#1E3FD1' },
  clause: { flexDirection: 'row', gap: 10 },
  clauseNum: { width: 32, height: 24, borderRadius: 8, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clauseNumText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#1E3FD1' },
  clauseText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20.3, color: '#26304A' },
  pages: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', gap: 8 },
  pageCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  thumb: {
    width: '100%', height: 26, borderRadius: 6, backgroundColor: '#F4F6FA', borderWidth: 1, borderColor: '#E4E8F0',
    paddingVertical: 5, paddingHorizontal: 8, gap: 3,
  },
  thumbOn: { backgroundColor: '#E8EEFF', borderColor: '#C9D6FF' },
  tl: { height: 3, borderRadius: 2, backgroundColor: '#D5DAE4' },
  // Dizayndagi kabi bir qatorda (white-space: nowrap) — ustundan chiqib ketsa ham kesilmaydi.
  pageLabel: { ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null), flexShrink: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  btns: { flexDirection: 'row', gap: 10 },
  dl: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dlText: { flexShrink: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#1E3FD1' },
  shareBtn: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
