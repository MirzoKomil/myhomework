/**
 * Kompyuter: Shartnoma (dizayn: D_Contract).
 *
 * Ma'lumot mobil ekran (app/v2/shartnoma.tsx) bilan bir xil: raqam/sana —
 * fetchDemoContract, buyurtmachi — fetchDemoStudentProfile, tarif/narx/
 * muddat/qarz — fetchDemoStudentPayments, kurs nomi — fetchMobileContent,
 * betlar soni va hajmi — PDF faylning o'zidan. "Toʻliq shartnoma (PDF)" —
 * haqiqiy PDF, ulashish — navigator.share (bo'lmasa havola nusxalanadi).
 */
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fetchContractPdfInfo, formatSize, type PdfInfo } from '@/components/v2/profile/contract';
import { courseEnd, dmy, money, parseIso } from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
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

import { CheckIcon, ChevronIcon, DocIcon, DownloadIcon, go, H, Over, PPage, ShieldIcon, T } from './ui';

// Shartnoma bo'limlari (PDF shabloni tartibida); 2-bo'lim — oldindagi varaqda ko'rsatilgan.
const SECTIONS = [
  { n: '1', label: 'Tomonlar', on: false },
  { n: '2', label: 'Majburiyat', on: true },
  { n: '3', label: 'Toʻlov', on: false },
  { n: '4', label: 'Imzolar', on: false },
];
const LINES = ['80%', '100%', '64%', '92%', '70%'] as const;

const ShareIcon = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#1E3FD1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 15V3M7 8l5-5 5 5" />
    <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Svg>
);

function Clause({ n, text }: { n: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <T size={14} color="#1E3FD1" lh={21.7} style={{ width: 30 }}>
        {n}
      </T>
      <T f="body" size={14} color="#34405A" lh={21.7} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

export function DContract() {
  const [contract, setContract] = useState<DemoContractResponse | null>(null);
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [pdf, setPdf] = useState<PdfInfo | null>(null);

  useEffect(() => {
    fetchDemoContract().then(setContract).catch(() => {});
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchMobileContent()
      .then((mc) => setCourseName(mc.courses[0]?.name ?? ''))
      .catch(() => {});
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
  const pdfLine = pdf ? `PDF · ${pages} bet · ${size}` : 'PDF';

  const download = () => Linking.openURL(getContractPdfUrl()).catch(() => {});
  const share = async () => {
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? new URL(getContractPdfUrl(), window.location.href).href : getContractPdfUrl();
    try {
      const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: 'Shartnoma', url });
      else await navigator.clipboard?.writeText(url);
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
  const place = ['Andijon', date ? dmy(date) : ''].filter(Boolean).join(' · ');

  return (
    <PPage title="Shartnoma" subtitle={pdfLine} back={R.payments}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
        {/* Shartnoma varag'i (qisqacha) */}
        <View style={s.desk}>
          <View accessibilityLabel="Shartnoma qisqacha" style={s.paper}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H size={20} lh={1.36} color="#2F5BFF">
                Domwork
              </H>
              <T f="bodyBold" size={13} color="#4A5468">
                {place}
              </T>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <T size={20}>{`Shartnoma №${contract?.number ?? ''}`}</T>
              <T f="body" size={13} color="#4A5468" style={{ textAlign: 'center' }}>
                {`Onlayn taʼlim xizmatlarini koʻrsatish haqida · Domwork MCHJ va ${profile?.name ?? ''}`}
              </T>
            </View>
            <View>
              {rows.map((r) => (
                <View key={r.k} style={s.kv}>
                  <T f="bodyBold" size={14} color="#4A5468">
                    {r.k}
                  </T>
                  <T size={14} style={{ textAlign: 'right', flexShrink: 1 }}>
                    {r.v}
                  </T>
                </View>
              ))}
            </View>
            <T size={16} style={{ marginTop: 4 }} accessibilityRole="header">
              Asosiy bandlar
            </T>
            <View style={{ gap: 8 }}>
              <T size={13} color="#4A5468">
                2-boʻlim · Majburiyatlar
              </T>
              <Clause n="2.1" text={`Ijrochi ${COURSE_TOTAL_LESSONS} ta darsni (videodars, jonli dars, uyga vazifa) ilova orqali 3 oy davomida taqdim etadi.`} />
              <Clause n="2.2" text="Buyurtmachi darslarda qatnashadi va toʻlovni oʻz vaqtida amalga oshiradi." />
            </View>
            <View style={{ gap: 8 }}>
              <T size={13} color="#4A5468">
                3-boʻlim · Toʻlov
              </T>
              <Clause n="3.1" text={`Qolgan summa — ${money(debt)} soʻm — ${due ? dmy(due) : '—'} gacha toʻlanadi (Click, Payme yoki naqd).`} />
            </View>
            <View style={s.sign}>
              <T f="bodyBold" size={13} color="#4A5468">
                Ijrochi: <T size={13}>Domwork MCHJ</T>
              </T>
              <View style={s.signed}>
                <CheckIcon size={14} color="#075E3A" sw={2.8} />
                <T size={13} color="#075E3A">
                  Elektron imzolangan
                </T>
              </View>
            </View>
          </View>
        </View>

        <View style={{ width: 380, gap: 20 }}>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={s.docBox}>
                <DocIcon size={26} sw={2.1} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={18}>{`Shartnoma №${contract?.number ?? ''}`}</T>
                <T f="bodyBold" size={14} color="#4A5468">
                  {pdfLine}
                </T>
              </View>
            </View>
            <View style={s.signedBox}>
              <ShieldIcon size={18} color="#075E3A" sw={2.2} />
              <T size={14} color="#075E3A" style={{ flex: 1 }}>
                {['Elektron imzolangan', place].filter(Boolean).join(' · ')}
              </T>
            </View>
          </View>

          <View accessibilityLabel={`Shartnoma sahifalari: ${pages} bet`} style={s.card}>
            <Over>{`Sahifalar · ${pages} bet`}</Over>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {SECTIONS.map((p) => (
                <View key={p.n} style={{ flex: 1, gap: 8, alignItems: 'center' }}>
                  <View style={[s.thumb, p.on && { borderColor: '#2F5BFF' }]}>
                    {LINES.map((w, i) => (
                      <View key={i} style={[s.tl, { width: w, backgroundColor: p.on ? '#BCCBFF' : '#E2E6EE' }]} />
                    ))}
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <T size={13} color={p.on ? '#1E3FD1' : '#4A5468'}>
                      {p.n}
                    </T>
                    <T f={p.on ? 'bodyHeavy' : 'bodyBold'} size={13} color={p.on ? '#1E3FD1' : '#4A5468'}>
                      {p.label}
                    </T>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Pressable accessibilityRole="link" onPress={() => go(R.payments)} style={[s.card, { paddingVertical: 20, gap: 10 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Over>3-boʻlim · Toʻlov holati</Over>
              <ChevronIcon />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T f="bodyBold" size={15} color="#4A5468">
                Toʻlangan
              </T>
              <T size={15} color="#087A4A">{`${money(paid)} soʻm`}</T>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T f="bodyBold" size={15} color="#4A5468">
                {`Qolgan${due ? ` · ${dmy(due)} gacha` : ''}`}
              </T>
              <T size={15} color="#B42318">{`${money(debt)} soʻm`}</T>
            </View>
          </Pressable>

          <View style={{ marginTop: 'auto', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Toʻliq shartnomani yuklab olish, PDF${pdf ? `, ${pages} bet, ${size}` : ''}`}
              onPress={download}
              style={s.dl}
            >
              <DownloadIcon color="#FFFFFF" sw={2.4} />
              <T size={16} color="#FFFFFF">
                Toʻliq shartnoma (PDF)
              </T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Ulashish" onPress={share} style={s.share}>
              <ShareIcon />
              <T size={15} color="#1E3FD1">
                Ulashish
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    </PPage>
  );
}

const s = StyleSheet.create({
  desk: { flex: 1, minWidth: 0, backgroundColor: '#E6EAF2', borderRadius: 28, paddingVertical: 24, paddingHorizontal: 56 },
  paper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(11,18,32,0.08), 0 12px 30px rgba(11,18,32,0.08)',
    paddingVertical: 34,
    paddingHorizontal: 40,
    gap: 16,
    overflow: 'hidden',
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  sign: {
    marginTop: 'auto',
    paddingTop: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D5DBE7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signed: { height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 5 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 14 },
  docBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  signedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E3F7EE', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  thumb: { width: '100%', aspectRatio: 0.72, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 2, borderColor: '#E2E6EE', paddingVertical: 12, paddingHorizontal: 10, gap: 6 },
  tl: { height: 4, borderRadius: 2 },
  dl: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  share: { height: 52, borderRadius: 17, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});
