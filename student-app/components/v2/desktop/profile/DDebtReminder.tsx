/**
 * Kompyuter: "To'lov eslatmasi" oynasi (dizayn: D_DebtReminder).
 *
 * Raqamlar mobil oyna (popups/DebtReminder.tsx) bilan bir xil: props orqali
 * (To'lovlar ekranidan) yoki o'zi yuklaydi — fetchDemoStudentPayments,
 * fetchDemoStudentProfile. Click/Payme — to'lov tizimlari saytlari,
 * menejer — Telegram. Markazdagi 560px karta; Esc yoki fon — yopish.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { DPopupFrame } from '@/components/v2/desktop/home/DPopupFrame';
import type { DebtReminderData } from '@/components/v2/popups/DebtReminder';
import { daysBetween, dmy, money, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentPayments, fetchDemoStudentProfile } from '@/services/contentApi';

import { ChevronIcon, CloseIcon, H, Over, T, TgIcon } from './ui';

export function DDebtReminder({ visible, onClose, data }: { visible: boolean; onClose: () => void; data?: DebtReminderData | null }) {
  const { courseLang } = useLang();
  const [own, setOwn] = useState<DebtReminderData | null>(null);

  useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    Promise.all([fetchDemoStudentPayments(), fetchDemoStudentProfile()])
      .then(([p, prof]) => {
        if (cancelled || !p) return;
        const paid = p.history.reduce((sum, h) => sum + (Number(h.paid) || 0), 0);
        setOwn({
          debt: p.debtAmount,
          paid,
          total: paid + p.debtAmount,
          dueDate: p.paymentDueDate,
          firstName: (prof?.name ?? '').split(' ')[0] ?? '',
          managerUrl: tgByPhone(prof?.salesManagerPhone ?? '', supportUrl(courseLang)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, data, courseLang]);

  const d = data ?? own;
  const due = parseIso(d?.dueDate);
  const left = due ? daysBetween(new Date(), due) : null;
  const ratio = d && d.total > 0 ? Math.min(1, d.paid / d.total) : 0;
  const managerUrl = d?.managerUrl || supportUrl(courseLang);
  const open = (url: string) => {
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <DPopupFrame visible={visible} onClose={onClose} width={560}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Image source={designImages.a8e6d559a994195b7358a2fd3f477f6c} accessibilityLabel="Kalendarli Domik" style={s.mascot} resizeMode="contain" />
        <H size={28} role="header" style={{ flex: 1 }}>
          Toʻlov eslatmasi
        </H>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
          <CloseIcon />
        </Pressable>
      </View>

      <View style={s.box}>
        <Over color="#B34700">Qolgan toʻlov</Over>
        <H size={36} color="#B42318">{`${money(d?.debt ?? 0)} soʻm`}</H>
        <T size={14} color="#B34700">
          {due ? `Muddat: ${dmy(due)}${left !== null && left >= 0 ? ` · ${left} kun qoldi` : ''}` : 'Muddat: —'}
        </T>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
        <T size={13} color="#075E3A">{`${money(d?.paid ?? 0)} / ${money(d?.total ?? 0)} soʻm toʻlangan`}</T>
      </View>

      <T f="body" size={15} color="#34405A" lh={23.25}>
        {`${d?.firstName ? `${d.firstName}, d` : 'D'}arslaringiz uzilmasligi uchun qolgan summani muddatigacha toʻlashingizni soʻraymiz. Qulay usulni tanlang — rahmat!`}
      </T>

      <View style={{ gap: 10 }}>
        <Method letter="C" bg="#1E3FD1" title="Click orqali toʻlash" sub="Karta yoki Click hamyon" onPress={() => open('https://my.click.uz')} />
        <Method letter="P" bg="#087A4A" title="Payme orqali toʻlash" sub="Uzcard / Humo" onPress={() => open('https://payme.uz')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <T f="bodyBold" size={13} color="#4A5468" style={{ flex: 1 }}>
          Naqd toʻlov yoki savol boʻlsa — menejerga
        </T>
        <Pressable accessibilityRole="link" onPress={() => open(managerUrl)} style={s.manager}>
          <TgIcon size={18} />
          <T size={15}>Menejer bilan bogʻlanish</T>
        </Pressable>
      </View>
    </DPopupFrame>
  );
}

function Method({ letter, bg, title, sub, onPress }: { letter: string; bg: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.method, hovered && { backgroundColor: '#FBFCFE' }]}>
      <View style={[s.letter, { backgroundColor: bg }]}>
        <T size={18} color="#FFFFFF">
          {letter}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={16}>{title}</T>
        <T f="bodyBold" size={13} color="#4A5468">
          {sub}
        </T>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

const s = StyleSheet.create({
  mascot: { width: 84, height: 84, marginTop: -8, marginBottom: -8, marginLeft: -4, flexShrink: 0 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  box: { backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20, gap: 6 },
  track: { marginTop: 6, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#087A4A' },
  method: { minHeight: 68, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 14 },
  letter: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  manager: { height: 52, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, flexShrink: 0 },
});
