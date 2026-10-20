/**
 * "profile" guruhi kompyuter ekranlari uchun umumiy bo'laklar: matn,
 * sarlavha (28px — D_Profile/D_Settings va h.k.), ikonkalar (D_*.dc.html
 * dagi SVG yo'llari aynan), almashtirgich va Sozlamalar ichki menyusi.
 */
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { LogoutConfirmPopup } from '@/components/v2/popups/LogoutConfirm';
import { groupFromTopic } from '@/components/v2/profile/shared';
import { fetchSessions } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchDemoSchedule, fetchDemoStudentProfile } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import { useCachedState } from '@/services/v2Cache';

type F = keyof typeof fonts;

export const go = (href: string) => router.push(href as Href);

/** Qisqa matn komponenti — dizayndagi shrift/o'lcham/rang bir qatorda. */
export function T({
  f = 'bodyHeavy',
  size = 14,
  color = '#0B1220',
  lh,
  ls,
  style,
  children,
  lines,
  accessibilityRole,
  accessibilityLabel,
}: {
  f?: F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  lines?: number;
  accessibilityRole?: TextProps['accessibilityRole'];
  accessibilityLabel?: string;
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={lines}
      style={[{ fontFamily: fonts[f], fontWeight: 'normal', fontSize: size, color, lineHeight: lh, letterSpacing: ls }, style]}
    >
      {children}
    </Text>
  );
}

/** Bricolage sarlavha (letter-spacing: -0.02em). */
export function H({ size, lh = 1.1, ls = -0.02, color = '#0B1220', style, children, lines, role }: { size: number; lh?: number; ls?: number; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode; lines?: number; role?: TextProps['accessibilityRole'] }) {
  return (
    <T f="display" size={size} lh={Math.round(size * lh * 10) / 10} ls={size * ls} color={color} style={style} lines={lines} accessibilityRole={role}>
      {children}
    </T>
  );
}

/** Ustki harfli kichik sarlavha (12px, 800, letter-spacing 0.06em, uppercase). */
export function Over({ children, color = '#4A5468', style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <T size={12} color={color} ls={0.72} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </T>
  );
}

/** Sahifa: DesktopPage + dizayndagi 28px sarlavha va 32px pastki chekka. */
export function PPage({
  title,
  subtitle,
  back,
  actions,
  children,
  contentStyle,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <DesktopPage
      title={title}
      back={back}
      actions={actions}
      titleSlot={
        <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
          <H size={28} role="header" lines={1}>
            {title}
          </H>
          {!!subtitle && (
            <T f="bodyBold" size={14} color="#4A5468" lines={1}>
              {subtitle}
            </T>
          )}
        </View>
      }
      contentStyle={[{ paddingBottom: 32 }, contentStyle]}
    >
      {children}
    </DesktopPage>
  );
}

// ---------- Ikonkalar (24×24 viewBox, dizayndagi yo'llar) ----------

type IP = { size?: number; color?: string; sw?: number };

function Ic({ size = 20, color = '#2F5BFF', sw = 2, children }: IP & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

const GEAR_D =
  'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';
const TG_D = 'M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z';
const FLAME_D = 'M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z';

export const GearIcon = (p: IP) => (
  <Ic {...p}>
    <Circle cx={12} cy={12} r={3} />
    <Path d={GEAR_D} />
  </Ic>
);
export const LockIcon = (p: IP) => (
  <Ic size={15} color="#5B6478" sw={2.2} {...p}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Ic>
);
export const UnlockIcon = (p: IP) => (
  <Ic size={15} color="#5B6478" sw={2.2} {...p}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} />
    <Path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </Ic>
);
export const PencilIcon = (p: IP) => (
  <Ic size={14} color="#FFFFFF" sw={2.8} {...p}>
    <Path d="M4 20h4L19 9l-4-4L4 16z" />
    <Path d="M13.5 6.5l4 4" />
  </Ic>
);
export const CameraIcon = (p: IP) => (
  <Ic size={17} color="#1E3FD1" sw={2.1} {...p}>
    <Rect x={3} y={5} width={18} height={15} rx={3} />
    <Circle cx={12} cy={12.5} r={3.5} />
    <Path d="M8 5l1.5-2h5L16 5" />
  </Ic>
);
export const TgIcon = ({ size = 16, color = '#0B1220' }: IP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d={TG_D} />
  </Svg>
);
export const ChartIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Ic>
);
export const VideoIcon = (p: IP) => (
  <Ic {...p}>
    <Rect x={2} y={6} width={14} height={12} rx={3} />
    <Path d="M16 10l6-3v10l-6-3" />
  </Ic>
);
export const StarIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
  </Ic>
);
export const FlameIcon = ({ size = 24, color = '#FF7A1A' }: IP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={FLAME_D} fill={color} />
  </Svg>
);
export const BoltIcon = ({ size = 32, color = '#FFC93C' }: IP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
export const CoinIcon = ({ size = 15 }: IP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const CalendarIcon = (p: IP) => (
  <Ic {...p}>
    <Rect x={3} y={5} width={18} height={16} rx={3} />
    <Path d="M3 10h18M8 3v4M16 3v4" />
  </Ic>
);
export const RibbonIcon = (p: IP) => (
  <Ic {...p}>
    <Circle cx={12} cy={9} r={6} />
    <Path d="M8.5 14 7 22l5-3 5 3-1.5-8" />
  </Ic>
);
export const TeacherIcon = (p: IP) => (
  <Ic {...p}>
    <Circle cx={9} cy={8} r={4} />
    <Path d="M2 21a7 7 0 0 1 14 0" />
    <Path d="M17 4l4 2-4 2M21 6v4" />
  </Ic>
);
export const CardIcon = (p: IP) => (
  <Ic {...p}>
    <Rect x={2.5} y={5} width={19} height={14} rx={3} />
    <Path d="M2.5 10h19M6.5 15h4" />
  </Ic>
);
export const BagIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
    <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Ic>
);
export const DevicesIcon = (p: IP) => (
  <Ic {...p}>
    <Rect x={2} y={4} width={14} height={11} rx={2} />
    <Path d="M6 19h6M9 15v4" />
    <Rect x={17} y={8} width={5} height={12} rx={1.5} />
  </Ic>
);
export const ChevronIcon = (p: IP) => (
  <Ic size={18} color="#6B7489" sw={2.2} {...p}>
    <Path d="M9 6l6 6-6 6" />
  </Ic>
);
export const ChevronDownIcon = (p: IP) => (
  <Ic size={20} color="#4A5468" sw={2.4} {...p}>
    <Path d="M6 9l6 6 6-6" />
  </Ic>
);
export const ChevronUpIcon = (p: IP) => (
  <Ic size={20} color="#1E3FD1" sw={2.4} {...p}>
    <Path d="M6 15l6-6 6 6" />
  </Ic>
);
export const GlobeIcon = (p: IP) => (
  <Ic {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </Ic>
);
export const DownloadIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Ic>
);
export const QuestionIcon = (p: IP) => (
  <Ic {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17h.01" />
  </Ic>
);
export const ShieldIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
  </Ic>
);
export const LogoutIcon = (p: IP) => (
  <Ic color="#B42318" sw={2.2} {...p}>
    <Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9" />
  </Ic>
);
export const BellIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </Ic>
);
export const MoonIcon = (p: IP) => (
  <Ic {...p}>
    <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Ic>
);
export const CheckIcon = (p: IP) => (
  <Ic size={15} color="#087A4A" sw={2.6} {...p}>
    <Path d="M5 12l5 5 9-10" />
  </Ic>
);
export const EyeIcon = (p: IP) => (
  <Ic size={16} color="#1E3FD1" sw={2.1} {...p}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Ic>
);
export const ClockIcon = (p: IP) => (
  <Ic size={16} color="#5A2FD6" sw={2.2} {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Ic>
);
export const DocIcon = (p: IP) => (
  <Ic color="#B42318" {...p}>
    <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <Path d="M14 3v5h5M9 13h6M9 17h4" />
  </Ic>
);
export const ArrowRightIcon = (p: IP) => (
  <Ic size={16} color="#1E3FD1" sw={2.4} {...p}>
    <Path d="M9 6l6 6-6 6" />
  </Ic>
);
export const XCircleIcon = (p: IP) => (
  <Ic size={18} color="#B42318" sw={2.2} {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M9 9l6 6M15 9l-6 6" />
  </Ic>
);
export const CloseIcon = (p: IP) => (
  <Ic size={20} color="#0B1220" sw={2.4} {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Ic>
);

// ---------- Almashtirgich (dizayn: 50×30, ichki 24px doira) ----------

export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[u.track, { backgroundColor: on ? '#2F5BFF' : '#C9D0DD' }]}>
      <View style={[u.knob, on ? { right: 3 } : { left: 3 }]} />
    </View>
  );
}

// ---------- Sozlamalar ichki menyusi (272px karta) ----------

export type SetKey = 'general' | 'language' | 'devices' | 'offline' | 'faq' | 'privacy';

const LANG_LABEL = { uz: 'Oʻzbekcha', ru: 'Русский' } as const;

/** Menyu kartasidagi ism/ID/guruh va qurilmalar soni — ekranlar orasida keshlanadi. */
export function useSettingsInfo() {
  const { token, student } = useAuth();
  const [name, setName] = useCachedState('dset.name', student?.name ?? '');
  const [sid, setSid] = useCachedState('dset.sid', '');
  const [group, setGroup] = useCachedState('dset.group', '');
  const [devices, setDevices] = useCachedState<number | null>('dset.devices', null);
  const refreshDevices = useCallback(() => {
    if (!token) return;
    fetchSessions()
      .then((l) => setDevices(l.length))
      .catch(() => setDevices(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    fetchDemoStudentProfile()
      .then((p) => {
        if (p?.name) setName(p.name);
        if (p?.studentId) setSid(p.studentId);
      })
      .catch(() => {});
    fetchDemoSchedule()
      .then((s) => setGroup(groupFromTopic(s?.topic)))
      .catch(() => {});
    refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return { name, sid, group, devices, refreshDevices };
}

export function SettingsNav({ active }: { active: SetKey }) {
  const info = useSettingsInfo();
  const avatar = useAvatarUri();
  const { lang } = useLang();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const item = (key: SetKey, label: string, href: string, icon: (c: string) => ReactNode, value?: string) => {
    const on = key === active;
    const c = on ? '#1E3FD1' : '#34405A';
    return (
      <Pressable
        key={key}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
        onPress={() => !on && go(href)}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [u.navItem, on ? u.navOn : hovered ? u.navHover : null]}
      >
        {icon(c)}
        <T f={on ? 'bodyHeavy' : 'bodyBold'} size={15} color={c}>
          {label}
        </T>
        {value !== undefined && (
          <T size={13} color={on ? '#1E3FD1' : '#4A5468'} style={{ marginLeft: 'auto' }}>
            {value}
          </T>
        )}
      </Pressable>
    );
  };
  const sub = [info.sid ? `ID ${info.sid}` : '', info.group].filter(Boolean).join(' · ');
  return (
    <View accessibilityLabel="Sozlamalar boʻlimlari" style={u.nav}>
      <Pressable accessibilityRole="link" onPress={() => go(R.profileEdit)} style={u.navProfile}>
        <Image source={avatar ? { uri: avatar } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={u.navAvatar} />
        <View style={{ gap: 1, minWidth: 0, flex: 1 }}>
          <T size={15} lines={1}>
            {info.name}
          </T>
          <T f="bodyBold" size={13} color="#4A5468" lines={1}>
            {sub}
          </T>
        </View>
      </Pressable>
      <View style={u.navHead}>
        <Over>Ilova</Over>
      </View>
      {item('general', 'Umumiy sozlamalar', R.settings, (c) => <GearIcon color={c} sw={active === 'general' ? 2.3 : 2} />)}
      {item('language', 'Ilova tili', R.language, (c) => <GlobeIcon color={c} sw={active === 'language' ? 2.3 : 2} />, LANG_LABEL[lang] ?? LANG_LABEL.uz)}
      {item('devices', 'Faol qurilmalar', R.devices, (c) => <DevicesIcon color={c} sw={active === 'devices' ? 2.3 : 2} />, info.devices === null ? '' : `${info.devices} ta`)}
      {/* Oflayn yuklash hali yo'q — mobil ekrandagidek 0 */}
      {item('offline', 'Oflayn darslar', R.offline, (c) => <DownloadIcon color={c} sw={active === 'offline' ? 2.3 : 2} />, '0 ta')}
      <View style={u.navHead}>
        <Over>Yordam</Over>
      </View>
      {item('faq', 'Savol-javoblar', R.faq, (c) => <QuestionIcon color={c} sw={active === 'faq' ? 2.3 : 2} />)}
      {item('privacy', 'Maxfiylik', R.privacy, (c) => <ShieldIcon color={c} sw={active === 'privacy' ? 2.3 : 2} />)}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={() => setLogoutOpen(true)} style={u.logout}>
        <LogoutIcon />
        <T size={15} color="#B42318">
          Hisobdan chiqish
        </T>
      </Pressable>
      <LogoutConfirmPopup visible={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </View>
  );
}

/** Sozlamalar sahifalari: chapda 272px menyu, o'ngda kontent (oraliq 24). */
export function SettingsLayout({
  active,
  title,
  subtitle,
  children,
}: {
  active: SetKey;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <PPage title={title} subtitle={subtitle} back={active === 'general' ? R.profile : R.settings} contentStyle={{ flexDirection: 'row', gap: 24 }}>
      <SettingsNav active={active} />
      <View style={{ flex: 1, minWidth: 0, gap: 20 }}>{children}</View>
    </PPage>
  );
}

export const u = StyleSheet.create({
  track: { width: 50, height: 30, borderRadius: 15, flexShrink: 0 },
  knob: { position: 'absolute', top: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(11,18,32,0.25)' },
  nav: { width: 272, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, gap: 2, alignSelf: 'stretch' },
  navProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
    marginBottom: 2,
  },
  navAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF1E6' },
  navHead: { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 6 },
  navItem: { height: 46, paddingHorizontal: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navOn: { backgroundColor: '#E8EEFF' },
  navHover: { backgroundColor: '#F4F6FA' },
  logout: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F7',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
});
