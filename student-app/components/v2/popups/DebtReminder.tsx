/**
 * "To'lov eslatmasi" pastki oynasi (dizayn: DebtReminder.dc.html).
 *
 * To'lovlar ekranidagi "Qarzni to'lash" tugmasidan ochiladi. Raqamlar
 * props orqali beriladi (fetchDemoStudentPayments dan hisoblangan);
 * berilmasa oyna o'zi yuklaydi. Click/Payme — dizayndagi kabi to'lov
 * tizimlari saytlariga (my.click.uz, payme.uz) havola; menejer — Telegram.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon, CloseIcon, TelegramIcon2 } from '@/components/v2/profile/icons';
import { daysBetween, dmy, money, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentPayments, fetchDemoStudentProfile } from '@/services/contentApi';
import { DDebtReminder } from '@/components/v2/desktop/profile/DDebtReminder';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

export type DebtReminderData = {
  /** Qolgan to'lov (so'm). */
  debt: number;
  /** To'langan (so'm). */
  paid: number;
  /** Kurs narxi (so'm). */
  total: number;
  /** To'lov muddati (ISO sana). */
  dueDate: string | null;
  firstName: string;
  /** Menejer Telegram manzili. */
  managerUrl: string;
};

export function DebtReminderPopup(props: { visible: boolean; onClose: () => void; data?: DebtReminderData | null }) {
  // Kompyuterda — markazdagi karta (D_DebtReminder dizayni), telefonda — avvalgidek.
  return useIsDesktop() ? <DDebtReminder {...props} /> : <DebtReminderPopupMobile {...props} />;
}

function DebtReminderPopupMobile({
  visible,
  onClose,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  data?: DebtReminderData | null;
}) {
  const insets = useSafeAreaInsets();
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
    return () => { cancelled = true; };
  }, [visible, data, courseLang]);

  const d = data ?? own;
  const due = parseIso(d?.dueDate);
  const left = due ? daysBetween(new Date(), due) : null;
  const ratio = d && d.total > 0 ? Math.min(1, d.paid / d.total) : 0;
  const managerUrl = d?.managerUrl || supportUrl(courseLang);
  const open = (url: string) => { void Linking.openURL(url).catch(() => {}); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, st.backdrop]} />
        <View style={st.column}>
          <View accessibilityViewIsModal style={[st.sheet, { paddingBottom: Math.max(28, insets.bottom + 12) }]}>
            <ScrollView bounces={false} contentContainerStyle={st.inner} showsVerticalScrollIndicator={false}>
              <View style={st.grip} />
              <View style={st.head}>
                <Image source={designImages.a8e6d559a994195b7358a2fd3f477f6c} accessibilityLabel="Kalendarli Domik" style={st.mascot} resizeMode="contain" />
                <Text accessibilityRole="header" style={st.title}>Toʻlov eslatmasi</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={st.close}>
                  <CloseIcon />
                </Pressable>
              </View>

              <View style={st.box}>
                <Text style={st.over}>Qolgan toʻlov</Text>
                <Text style={st.amount}>{`${money(d?.debt ?? 0)} soʻm`}</Text>
                <Text style={st.due}>
                  {due ? `Muddat: ${dmy(due)}${left !== null && left >= 0 ? ` · ${left} kun qoldi` : ''}` : 'Muddat: —'}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <View style={st.track}><View style={[st.fill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
                </View>
                <Text style={st.paid}>{`${money(d?.paid ?? 0)} / ${money(d?.total ?? 0)} soʻm toʻlangan`}</Text>
              </View>

              <Text style={st.body}>
                {`${d?.firstName ? `${d.firstName}, d` : 'D'}arslaringiz uzilmasligi uchun qolgan summani muddatigacha toʻlashingizni soʻraymiz. Qulay usulni tanlang — rahmat!`}
              </Text>

              <View style={{ gap: 8 }}>
                <Pressable accessibilityRole="link" onPress={() => open('https://my.click.uz')} style={({ pressed }) => [st.method, pressed && st.pressed]}>
                  <View style={[st.methodIcon, { backgroundColor: '#1E3FD1' }]}><Text style={st.methodLetter}>C</Text></View>
                  <View style={st.methodText}>
                    <Text style={st.methodTitle}>Click orqali toʻlash</Text>
                    <Text style={st.methodSub}>Karta yoki Click hamyon</Text>
                  </View>
                  <ChevronIcon />
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => open('https://payme.uz')} style={({ pressed }) => [st.method, pressed && st.pressed]}>
                  <View style={[st.methodIcon, { backgroundColor: '#087A4A' }]}><Text style={st.methodLetter}>P</Text></View>
                  <View style={st.methodText}>
                    <Text style={st.methodTitle}>Payme orqali toʻlash</Text>
                    <Text style={st.methodSub}>Uzcard / Humo</Text>
                  </View>
                  <ChevronIcon />
                </Pressable>
              </View>

              <Pressable accessibilityRole="link" onPress={() => open(managerUrl)} style={({ pressed }) => [st.manager, pressed && st.pressed]}>
                <TelegramIcon2 color="#1B6FA8" />
                <Text style={st.managerText}>Menejer bilan bogʻlanish</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.35)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
  },
  inner: { gap: 14 },
  pressed: { opacity: 0.85 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mascot: { width: 64, height: 64, flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 33, letterSpacing: -0.48, color: '#0B1220' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  box: { backgroundColor: '#FFF4D1', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  over: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: '#8A5A00' },
  amount: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 30, lineHeight: 33, color: '#8A5A00' },
  due: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#5C4300' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#087A4A' },
  paid: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#5C4300' },
  body: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 21, color: '#4A5468' },
  method: {
    minHeight: 62, borderRadius: 18, borderWidth: 1.5, borderColor: '#E4E8F0', paddingLeft: 10, paddingRight: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  methodLetter: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#FFFFFF' },
  methodText: { flex: 1, gap: 1 },
  methodTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  methodSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  manager: {
    height: 52, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E4E8F0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  managerText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
});
