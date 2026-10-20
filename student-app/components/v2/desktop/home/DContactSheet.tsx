/**
 * Kompyuter: "Kimga yozasiz?" oynasi (dizayn: D_ContactSheet).
 * Ma'lumot mobil ContactSheet bilan bir xil: ustozlar — fetchDemoStudentProfile,
 * suhbat Telegramda (ustoz raqami orqali), support — eski Kontaktlar manzili.
 * Yon menyudagi "Ustozga yozish" ham shu oynani ochadi. Esc — yopish.
 */
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Kbd } from '@/components/v2/desktop/Shell';
import { supportUrl } from '@/components/v2/home/shared';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { fetchDemoStudentProfile } from '@/services/contentApi';

import { DPopupFrame } from './DPopupFrame';
import { ClockIcon, CloseIcon, TgIcon } from './icons';

type Contact = { key: string; name: string; role: string; url: string; avatarBg: string; initials: string; online?: boolean };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

// Mobil ekrandagidek: ustoz raqami orqali suhbat, raqam bo'lmasa — support.
const tgByPhone = (phone: string, fallback: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? `https://t.me/+${digits.length === 9 ? '998' + digits : digits}` : fallback;
};

export function DContactSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
          list.push({
            key: 'main',
            name: p.mainTeacherName,
            role: 'Asosiy ustoz · jonli darslar',
            url: tgByPhone(p.mainTeacherPhone, support),
            avatarBg: '#2F5BFF',
            initials: initialsOf(p.mainTeacherName),
            // Ustozlarim ekranidagidek asosiy ustozda "Onlayn" belgisi.
            online: true,
          });
        if (p.assistantTeacherName)
          list.push({
            key: 'assistant',
            name: p.assistantTeacherName,
            role: 'Yordamchi ustoz · darsdan keyingi amaliyot',
            url: tgByPhone(p.assistantTeacherPhone, support),
            avatarBg: '#7C4DFF',
            initials: initialsOf(p.assistantTeacherName),
          });
        setTeachers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, support]);

  const ru = courseLang === 'russian';
  const contacts: Contact[] = [
    ...teachers,
    { key: 'support', name: ru ? 'Domwork support' : 'Homework support', role: 'Toʻlov va texnik savollar', url: support, avatarBg: '#0B1220', initials: ru ? 'D' : 'H' },
  ];
  const open = (url: string) => {
    void Linking.openURL(url);
    onClose();
  };

  return (
    <DPopupFrame visible={visible} onClose={onClose} width={520}>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={s.title}>
            Kimga yozasiz?
          </Text>
          <View style={s.subRow}>
            <TgIcon size={16} color="#1B8BC9" />
            <Text style={s.sub}>Suhbat Telegramda ochiladi</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
          <CloseIcon />
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        {contacts.map((c) => (
          <Pressable
            key={c.key}
            accessibilityRole="link"
            accessibilityLabel={`${c.name}, ${c.role}. Telegramda ochish`}
            onPress={() => open(c.url)}
            style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, hovered && { backgroundColor: '#EEF1F7' }]}
          >
            <View style={[s.avatar, { backgroundColor: c.avatarBg }]}>
              <Text style={s.avatarText}>{c.initials}</Text>
              {c.online && <View accessibilityRole="image" accessibilityLabel="Onlayn" style={s.online} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{c.name}</Text>
              <Text style={s.role}>{c.role}</Text>
            </View>
            <View accessibilityRole="image" accessibilityLabel="Telegramda ochish" style={s.tg}>
              <TgIcon size={20} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={s.note}>
        <ClockIcon size={17} color="#4A5468" strokeWidth={2.2} />
        <Text style={[s.noteText, { flex: 1 }]}>Ustozlar odatda 1–2 soat ichida javob beradi</Text>
        <Kbd>Esc</Kbd>
        <Text style={[s.noteText, { fontSize: 13 }]}>yopish</Text>
      </View>
    </DPopupFrame>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  title: T(fonts.display, 28, { lineHeight: 30.8, letterSpacing: -0.56, color: '#0B1220' }),
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sub: T(fonts.bodyBold, 15, { color: '#4A5468' }),
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 84, paddingLeft: 14, paddingRight: 16, borderRadius: 20, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: T(fonts.bodyHeavy, 20, { color: '#FFFFFF' }),
  // CSS: 14px + 3px chegara (content-box) = 20px.
  online: { position: 'absolute', right: 1, bottom: 1, width: 20, height: 20, borderRadius: 7, backgroundColor: '#12B76A', borderWidth: 3, borderColor: '#FFFFFF' },
  name: T(fonts.bodyHeavy, 17, { color: '#0B1220' }),
  role: T(fonts.body, 14, { color: '#4A5468' }),
  tg: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  noteText: T(fonts.bodyBold, 14, { color: '#4A5468' }),
});
