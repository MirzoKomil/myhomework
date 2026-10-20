/**
 * Kompyuter: Maxfiylik siyosati (dizayn: D_Privacy).
 *
 * Siyosat matni statik — mobil ekran (app/v2/sozlamalar/maxfiylik.tsx)
 * bilan aynan bir xil matn. Support — Telegram (SUPPORT_TELEGRAM_URL).
 */
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { SUPPORT_TELEGRAM_URL } from '@/components/v2/settings/parts';

import { SettingsLayout } from './settingsNav';
import { ClockIcon, EyeIcon, ShieldIcon, T, TgIcon, XCircleIcon } from './ui';

const DbIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1E3FD1" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
    <Ellipse cx={12} cy={6} rx={8} ry={3} />
    <Path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Svg>
);
const TargetIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#087A4A" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Circle cx={12} cy={12} r={5} />
    <Circle cx={12} cy={12} r={1.5} />
  </Svg>
);

const SECTIONS = [
  {
    title: 'Qanday maʼlumot yigʻamiz',
    body: 'Ism, familiya, telefon raqam, login, dars natijalari, vazifa javoblari, coin va chaqmoqlar hamda qurilma turi.',
    bg: '#E8EEFF',
    icon: <DbIcon />,
  },
  {
    title: 'Nima uchun',
    body: 'Darslarni ochish, vazifalarni avtomatik tekshirish, eslatma yuborish va toʻlovlarni hisoblash uchun.',
    bg: '#E3F7EE',
    icon: <TargetIcon />,
  },
  {
    title: 'Kim koʻradi',
    body: 'Faqat siz, ustozlaringiz va Domwork menejeri. Reytingda boshqalar faqat ismingiz, avataringiz, chaqmoqlaringiz, dars soni va seriyangizni koʻradi.',
    bg: '#F0EBFF',
    icon: <EyeIcon size={24} color="#6A3CF0" sw={2.1} />,
  },
  {
    title: 'Saqlash muddati',
    body: 'Kurs tugaganidan keyin 12 oy saqlanadi, soʻng oʻchiriladi. Oʻchirishni istalgan vaqtda supportdan soʻrashingiz mumkin.',
    bg: '#FFF1E6',
    icon: <ClockIcon size={24} color="#B34700" sw={2.1} />,
  },
];

const NOT_STORED = [
  'Bank karta maʼlumotlari (toʻlov Click / Payme orqali)',
  'Ovoz yozuvlari — mikrofon ishlatilmaydi',
  'Kontaktlar va galereya (faqat siz tanlagan avatar)',
];

function Head({ title, bg, icon, box = 48 }: { title: string; bg: string; icon: React.ReactNode; box?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={[s.icon, { width: box, height: box, borderRadius: box === 48 ? 15 : 14, backgroundColor: bg }]}>{icon}</View>
      <T size={18} lh={22.5} accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </T>
    </View>
  );
}

export function DPrivacy() {
  return (
    <SettingsLayout active="privacy" title="Maxfiylik siyosati" subtitle="Yangilangan: 01.09.2026">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.card}>
            <Head title={sec.title} bg={sec.bg} icon={sec.icon} />
            <T f="body" size={16} color="#34405A" lh={24.8}>
              {sec.body}
            </T>
          </View>
        ))}
      </View>
      <View style={[s.card, { flexGrow: 0, flexBasis: 'auto' }]}>
        <Head title="Nimani saqlamaymiz" bg="#FDECEC" icon={<ShieldIcon size={22} color="#B42318" sw={2.1} />} box={44} />
        <View accessibilityRole="list" style={{ flexDirection: 'row', gap: 12 }}>
          {NOT_STORED.map((t) => (
            <View key={t} style={s.li}>
              <XCircleIcon size={20} sw={2} />
              <T f="bodyBold" size={14} lh={20.3} style={{ flex: 1 }}>
                {t}
              </T>
            </View>
          ))}
        </View>
      </View>
      <View style={s.support}>
        <T f="bodyBold" size={15} color="#1E3FD1" style={{ flex: 1 }}>
          Savol yoki maʼlumotni oʻchirish soʻrovi boʻlsa — supportga yozing
        </T>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(SUPPORT_TELEGRAM_URL).catch(() => {})} style={s.tg}>
          <TgIcon size={18} />
          <T size={15}>Supportga yozish</T>
        </Pressable>
      </View>
    </SettingsLayout>
  );
}

const s = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: '40%', minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 26, gap: 16 },
  icon: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  li: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 16 },
  support: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#E8EEFF', borderRadius: 22, paddingVertical: 14, paddingRight: 16, paddingLeft: 22 },
  tg: { height: 48, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, flexShrink: 0 },
});
