/**
 * v2 Shartnoma (dizayn: Contract.dc.html).
 *
 * Shartnoma raqami/sanasi — fetchDemoContract (CRM biriktirgan, PDF bilan
 * bir xil), buyurtmachi — fetchDemoStudentProfile, tarif/narx/muddat —
 * fetchDemoStudentPayments. Betlar soni va hajmi — PDF faylning o'zidan.
 * "Yuklab olish" — haqiqiy PDF (getContractPdfUrl), "Ulashish" — tizim
 * ulashish oynasi (webda navigator.share bo'lmasa havola nusxalanadi).
 */
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchContractPdfInfo, formatSize, type PdfInfo } from '@/components/v2/profile/contract';
import { DownloadIcon, ShareIcon } from '@/components/v2/profile/icons';
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

const PAGE_H = 444;
const PAGE_GAP = 14;
const LINES = ['100%', '94%', '98%', '72%'] as const;

function Lines({ times = 1 }: { times?: number }) {
  return (
    <>
      {Array.from({ length: times }).flatMap((_, k) =>
        LINES.map((w, i) => <View key={`${k}-${i}`} style={[st.line, { width: w }]} />),
      )}
    </>
  );
}

export default function V2Contract() {
  const insets = useSafeAreaInsets();
  const [contract, setContract] = useState<DemoContractResponse | null>(null);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [pdf, setPdf] = useState<PdfInfo | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDemoContract().then(setContract).catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchMobileContent().then((mc) => setCourseName(mc.courses[0]?.name ?? '')).catch(() => {});
    fetchContractPdfInfo().then(setPdf);
  }, []);

  const pages = pdf?.pages ?? 0;
  const date = parseIso(contract?.date);
  const start = parseIso(pay?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const paid = (pay?.history ?? []).reduce((s, h) => s + (Number(h.paid) || 0), 0);
  const price = paid + (pay?.debtAmount ?? 0);
  // Ijrochi va imzolangan joy — maktab rekvizitlari (dizayndagi kabi).
  const brand = 'Domwork';

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setPage(Math.min(Math.max(1, pages), Math.floor((y + PAGE_H / 2) / (PAGE_H + PAGE_GAP)) + 1));
  };

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
    { k: 'Hajmi', v: `${COURSE_TOTAL_LESSONS} dars · 3 oy` },
    { k: 'Tarif', v: pay ? `${pay.tariffLabel} · ${pay.lessonDuration} daqiqalik jonli dars` : '' },
    { k: 'Muddat', v: start && end ? `${dmy(start)} – ${dmy(end)}` : '' },
    { k: 'Narx', v: `${money(price)} soʻm` },
  ];

  return (
    <View style={st.screen}>
      <Header
        title="Shartnoma"
        subtitle={pdf ? `PDF · ${pages} bet · ${formatSize(pdf.bytes)}` : 'PDF'}
        fallback={R.payments}
      />
      <Column style={[st.body, { paddingBottom: Math.max(22, insets.bottom + 12) }]}>
        <View style={st.viewer}>
          <ScrollView onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={st.pages} showsVerticalScrollIndicator={false}>
            <View accessibilityLabel="Shartnoma, 1-bet" style={[st.page, { gap: 9 }]}>
              <View style={st.pTop}>
                <Text style={st.pBrand}>{brand}</Text>
                <Text style={st.pSmall}>{['Andijon', date ? dmy(date) : ''].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={st.pTitle}>{`Shartnoma №${contract?.number ?? ''} · ${brand}`}</Text>
              <Text style={[st.pSmall, { textAlign: 'center' }]}>Onlayn taʼlim xizmatlarini koʻrsatish haqida</Text>
              <Text style={st.pParty}>
                <Text style={st.pBold}>Ijrochi:</Text>
                {` «${brand}» rus tili onlayn maktabi.\n`}
                <Text style={st.pBold}>Buyurtmachi:</Text>
                {` ${profile?.name ?? ''}, ID ${profile?.studentId ?? ''}.`}
              </Text>
              <Text style={st.pH}>1. Shartnoma predmeti</Text>
              <View>
                {rows.map((r) => (
                  <View key={r.k} style={st.pRow}>
                    <Text style={st.pK}>{r.k}</Text>
                    <Text style={st.pV}>{r.v}</Text>
                  </View>
                ))}
              </View>
              <Text style={st.pH}>2. Tomonlarning majburiyatlari</Text>
              <View style={{ gap: 5 }}><Lines /></View>
              <View style={{ flex: 1 }} />
              <View style={st.pFoot}>
                <Text style={st.pSign}>Ijrochi: ________</Text>
                <View style={st.signed}><Text style={st.signedText}>Elektron imzolangan</Text></View>
              </View>
            </View>
            {Array.from({ length: Math.max(0, pages - 1) }).map((_, i) => (
              <View key={i} accessibilityLabel={`Shartnoma, ${i + 2}-bet`} style={[st.page, { gap: 8 }]}>
                {i === 0 && <Text style={[st.pH, { fontSize: 11, marginTop: 0 }]}>3. Toʻlov tartibi</Text>}
                <Lines times={2} />
              </View>
            ))}
          </ScrollView>
          {pages > 0 && (
            <View accessibilityLabel={`${page}-bet, jami ${pages} bet`} style={st.counter}>
              <Text style={st.counterText}>{`${page} / ${pages}`}</Text>
            </View>
          )}
        </View>
        <View style={st.btns}>
          <Pressable accessibilityRole="button" onPress={download} style={({ pressed }) => [st.btn, st.primary, pressed && st.pressed]}>
            <DownloadIcon />
            <Text style={[st.btnText, { color: '#FFFFFF' }]}>Yuklab olish</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={share} style={({ pressed }) => [st.btn, { backgroundColor: '#E8EEFF' }, pressed && st.pressed]}>
            <ShareIcon />
            <Text style={[st.btnText, { color: '#1E3FD1' }]}>Ulashish</Text>
          </Pressable>
        </View>
      </Column>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  pressed: { opacity: 0.85 },
  viewer: { flex: 1, minHeight: 0, backgroundColor: '#DDE2EC', borderRadius: 24, overflow: 'hidden' },
  pages: { alignItems: 'center', gap: PAGE_GAP, paddingTop: 16, paddingBottom: 56 },
  page: {
    width: 314, height: PAGE_H, backgroundColor: '#FFFFFF', borderRadius: 6, paddingVertical: 22, paddingHorizontal: 20,
    boxShadow: '0 8px 24px rgba(11,18,32,0.16)',
  },
  pTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pBrand: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 13, color: '#2F5BFF' },
  pSmall: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 9.5, lineHeight: 13, color: '#4A5468' },
  pTitle: { marginTop: 2, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 15, lineHeight: 18, textAlign: 'center', color: '#0B1220' },
  pParty: { marginTop: 2, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 10, lineHeight: 14.5, color: '#0B1220' },
  pBold: { fontFamily: fonts.bodyHeavy },
  pH: { marginTop: 2, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 10.5, lineHeight: 14, color: '#0B1220' },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  pK: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#4A5468' },
  pV: { flexShrink: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, lineHeight: 15, color: '#0B1220', textAlign: 'right' },
  line: { height: 5, borderRadius: 3, backgroundColor: '#E4E8F0' },
  pFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pSign: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 9, color: '#4A5468' },
  signed: { height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: '#E3F7EE', justifyContent: 'center' },
  signedText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 9, color: '#075E3A' },
  counter: {
    position: 'absolute', bottom: 12, alignSelf: 'center', height: 30, paddingHorizontal: 12, borderRadius: 15,
    backgroundColor: 'rgba(11,18,32,0.82)', justifyContent: 'center',
  },
  counterText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#FFFFFF' },
  btns: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primary: { backgroundColor: '#2F5BFF', borderBottomWidth: 4, borderBottomColor: '#1E3FD1' },
  btnText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
});
