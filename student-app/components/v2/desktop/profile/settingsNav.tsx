/**
 * Sozlamalar sahifalarining ichki menyusi (272px karta, D_Settings va
 * D_Language/D_Devices/D_FAQ/D_Privacy/D_Offline dagi chap ustun) va
 * shu sahifalar joylashuvi. Alohida faylda — popups/LogoutConfirm bilan
 * aylana import bo'lmasligi uchun.
 */
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { LogoutConfirmPopup } from '@/components/v2/popups/LogoutConfirm';
import { groupFromTopic } from '@/components/v2/profile/shared';
import { fetchSessions } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchDemoSchedule, fetchDemoStudentProfile } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import { useCachedState } from '@/services/v2Cache';

import { DevicesIcon, DownloadIcon, GearIcon, GlobeIcon, go, LogoutIcon, Over, PPage, QuestionIcon, ShieldIcon, T } from './ui';

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
  // ?popup=logout — chiqish oynasini to'g'ridan-to'g'ri ochish (skrinshot/havola uchun).
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [logoutOpen, setLogoutOpen] = useState(popup === 'logout');
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

const u = StyleSheet.create({
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
