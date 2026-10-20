/**
 * "Kimga yozasiz?" pastki oynasi (dizayn: ContactSheet.dc.html).
 *
 * Ustozlar — CRM'da o'quvchiga biriktirilgan asosiy/yordamchi ustoz
 * (fetchDemoStudentProfile, eski profile/teacher.tsx bilan bir xil manba).
 * Suhbat Telegramda ochiladi: ustoz telefon raqami orqali (t.me/+998...),
 * qo'llab-quvvatlash — eski Kontaktlar ekranidagi manzil.
 */
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DContactSheet } from '@/components/v2/desktop/home/DContactSheet';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { ClockIcon, CloseIcon, TelegramIcon } from '@/components/v2/home/icons';
import { supportUrl } from '@/components/v2/home/shared';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentProfile } from '@/services/contentApi';

type Contact = { key: string; name: string; role: string; url: string; avatarBg: string; initials: string; square?: boolean };

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

// Telegram raqam orqali suhbat ochadi; raqam bo'lmasa qo'llab-quvvatlashga.
const tgByPhone = (phone: string, fallback: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? `https://t.me/+${digits.length === 9 ? '998' + digits : digits}` : fallback;
};

export function ContactSheetPopup(props: { visible: boolean; onClose: () => void }) {
  // Kompyuterda — markazdagi karta (D_ContactSheet), telefonda — pastki oyna.
  return useIsDesktop() ? <DContactSheet {...props} /> : <ContactSheetPopupMobile {...props} />;
}

function ContactSheetPopupMobile({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const support = supportUrl(courseLang);
  const [teachers, setTeachers] = useState<Contact[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchDemoStudentProfile()
      .then((p) => {
        if (cancelled || !p) return;
        const list: Contact[] = [];
        if (p.mainTeacherName)
          list.push({ key: 'main', name: p.mainTeacherName, role: 'Asosiy ustoz · jonli darslar', url: tgByPhone(p.mainTeacherPhone, support), avatarBg: '#2F5BFF', initials: initialsOf(p.mainTeacherName) });
        if (p.assistantTeacherName)
          list.push({ key: 'assistant', name: p.assistantTeacherName, role: 'Yordamchi ustoz · darsdan keyingi amaliyot', url: tgByPhone(p.assistantTeacherPhone, support), avatarBg: '#6A3CF0', initials: initialsOf(p.assistantTeacherName) });
        setTeachers(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, support]);

  const contacts: Contact[] = [
    ...teachers,
    { key: 'support', name: courseLang === 'russian' ? 'Domwork support' : 'Homework support', role: 'Toʻlov va texnik savollar', url: support, avatarBg: '#0B1220', initials: courseLang === 'russian' ? 'D' : 'H', square: true },
  ];

  const open = (url: string) => { void Linking.openURL(url); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View style={styles.column}>
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
            <ScrollView bounces={false} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
              <View style={styles.grip} />
              <View style={styles.head}>
                <View style={styles.headText}>
                  <Text style={styles.title} accessibilityRole="header">Kimga yozasiz?</Text>
                  <Text style={styles.sub}>Suhbat Telegramda ochiladi</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={styles.close}>
                  <CloseIcon />
                </Pressable>
              </View>

              <View style={styles.list}>
                {contacts.map((c) => (
                  <Pressable
                    key={c.key}
                    accessibilityRole="link"
                    accessibilityLabel={`${c.name}, ${c.role}. Telegramda ochish`}
                    onPress={() => open(c.url)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#E7EBF3' }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: c.avatarBg }, c.square && { borderRadius: 16 }]}>
                      <Text style={[styles.avatarText, c.square && { fontFamily: fonts.display, fontSize: 20 }]}>{c.initials}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.name}>{c.name}</Text>
                      <Text style={styles.role}>{c.role}</Text>
                    </View>
                    <View style={styles.tg}>
                      <TelegramIcon size={19} />
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={styles.note}>
                <ClockIcon />
                <Text style={styles.noteText}>Ustozlar odatda 1–2 soat ichida javob beradi</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.35)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20 },
  inner: { gap: 14 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DBE7' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.48, color: '#0B1220', fontWeight: 'normal' },
  sub: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', fontWeight: 'normal' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8 },
  // Dizayn: min-height 72 + padding 12 (content-box) — jami 96.
  row: { minHeight: 96, borderRadius: 20, backgroundColor: '#F4F6FA', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  role: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  tg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  noteText: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal', flexShrink: 1 },
});
