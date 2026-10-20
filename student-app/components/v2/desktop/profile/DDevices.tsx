/**
 * Kompyuter: Faol qurilmalar (dizayn: D_Devices).
 *
 * Mantiq mobil ekran (app/v2/sozlamalar/qurilmalar.tsx) bilan bir xil:
 * serverdagi haqiqiy sessiyalar (`/api/auth/sessions`). Serverda shahar
 * aniqlanmaydi — joylashuv qatorida sessiyaning IP manzili. "Oxirgi
 * kirishlar" — sessiyalarning yaratilgan (login) vaqti bo'yicha. Limit 3 —
 * dizayndagi matn (serverda hozircha cheklov yo'q).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, View, Pressable } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { SUPPORT_TELEGRAM_URL } from '@/components/v2/settings/parts';
import { fetchSessions, lastSeenLabel, loginTimeLabel, parseUserAgent, type DeviceSession } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';

import { ClockIcon, DevicesIcon, H, Over, SettingsLayout, T, TgIcon } from './ui';

const DEVICE_LIMIT = 3;

const PhoneIcon = ({ size = 30, color = '#1E3FD1', sw = 2.1 }: { size?: number; color?: string; sw?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={6} y={2.5} width={12} height={19} rx={3} />
    <Path d="M11 18.5h2" />
  </Svg>
);
const LaptopIcon = ({ size = 30, color = '#1E3FD1', sw = 2.1 }: { size?: number; color?: string; sw?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={4} y={4.5} width={16} height={11} rx={2} />
    <Path d="M2 19.5h20" />
  </Svg>
);
const PinIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4A5468" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" />
    <Circle cx={12} cy={9.5} r={2.5} />
  </Svg>
);
const PlusIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#6B7489" strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export function DDevices() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const logins = [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useFocusEffect(
    useCallback(() => {
      fetchSessions()
        .then(setSessions)
        .catch(() => setSessions([]));
    }, []),
  );

  return (
    <SettingsLayout active="devices" title="Faol qurilmalar" subtitle={`Hisobingizga kirilgan ${sessions.length} ta qurilma`}>
      <View accessibilityRole="list" style={s.grid}>
        {sessions.map((ses) => {
          const d = parseUserAgent(ses.userAgent);
          return (
            <View key={ses.id} style={[s.device, ses.isCurrent && { boxShadow: 'inset 0 0 0 2px #BFE8D3' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <View style={s.devIcon}>{d.mobile ? <PhoneIcon /> : <LaptopIcon />}</View>
                <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
                  <H size={24} lines={1}>
                    {d.name}
                  </H>
                  <View style={[s.tag, { backgroundColor: ses.isCurrent ? '#E3F7EE' : '#EEF1F7' }]}>
                    <T size={13} color={ses.isCurrent ? '#075E3A' : '#34405A'}>
                      {ses.isCurrent ? 'Shu qurilma' : 'Boshqa qurilma'}
                    </T>
                  </View>
                </View>
              </View>
              <View style={s.meta}>
                <View style={s.metaRow}>
                  <DevicesIcon size={18} color="#4A5468" />
                  <T f="bodyBold" size={15} color="#34405A">
                    {d.kind}
                  </T>
                </View>
                {!!ses.ip && (
                  <View style={s.metaRow}>
                    <PinIcon />
                    <T f="bodyBold" size={15} color="#34405A">
                      {ses.ip}
                    </T>
                  </View>
                )}
              </View>
              {ses.isCurrent ? (
                <View style={[s.metaRow, { gap: 9 }]}>
                  <View style={s.dot} />
                  <T size={15} color="#087A4A">
                    Hozir faol
                  </T>
                </View>
              ) : (
                <View style={[s.metaRow, { gap: 9 }]}>
                  <ClockIcon size={18} color="#4A5468" sw={2} />
                  <T f="bodyBold" size={15} color="#34405A">
                    {lastSeenLabel(ses.lastSeen)}
                  </T>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={[s.card, { gap: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Over>Faol qurilmalar soni</Over>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <H size={30} lh={1}>
                {String(sessions.length)}
              </H>
              <T size={17} color="#4A5468">{`/ ${DEVICE_LIMIT}`}</T>
            </View>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: DEVICE_LIMIT }, (_, i) => {
              const ses = sessions[i];
              if (!ses) {
                return (
                  <View key={i} style={[s.slot, s.slotEmpty]}>
                    <PlusIcon />
                    <T size={13} color="#4A5468">
                      Boʻsh joy
                    </T>
                  </View>
                );
              }
              const mobile = parseUserAgent(ses.userAgent).mobile;
              return (
                <View key={i} style={s.slot}>
                  {mobile ? <PhoneIcon size={26} sw={2} /> : <LaptopIcon size={26} sw={2} />}
                  <T size={13} color="#1E3FD1">
                    {mobile ? 'Telefon' : 'Kompyuter'}
                  </T>
                </View>
              );
            })}
          </View>
          <T f="body" size={14} color="#4A5468" lh={21}>
            Limit — bir vaqtda 3 ta qurilma. Yangi qurilmadan kirsangiz, eng eski qurilma avtomatik chiqariladi.
          </T>
        </View>
        <View style={[s.card, { gap: 8 }]}>
          <Over>Oxirgi kirishlar</Over>
          <View accessibilityRole="list" style={{ flex: 1 }}>
            {logins.map((ses, i) => {
              const d = parseUserAgent(ses.userAgent);
              return (
                <View key={ses.id} style={[s.login, i < logins.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' }]}>
                  <View style={s.loginIcon}>
                    <ClockIcon size={19} color="#4A5468" sw={2} />
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <T size={15}>{loginTimeLabel(ses.createdAt)}</T>
                    <T f="body" size={14} color="#4A5468" lines={1}>
                      {ses.ip ? `${d.name} · ${ses.ip}` : d.name}
                    </T>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={s.warn}>
        <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} style={{ width: 68, height: 68 }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <T size={16}>Notanish qurilma koʻrsangiz, menejerga yozing</T>
          <T f="body" size={14} color="#34405A" lh={21}>
            Menejer parolingizni yangilab, notanish qurilmani hisobdan chiqaradi. Login va parolni hech kimga bermang.
          </T>
        </View>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(SUPPORT_TELEGRAM_URL).catch(() => {})} style={s.tg}>
          <TgIcon size={18} />
          <T size={15}>Menejerga yozish</T>
        </Pressable>
      </View>
    </SettingsLayout>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  device: { flexGrow: 1, flexBasis: '40%', minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 26, gap: 20 },
  devIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tag: { height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: 'center' },
  meta: { backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#12B76A', boxShadow: '0 0 0 4px #E3F7EE' },
  card: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  slot: { flex: 1, borderRadius: 18, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 6 },
  slotEmpty: { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9D0DD', paddingVertical: 12 },
  login: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  loginIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  warn: { backgroundColor: '#FFF4D1', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  tg: { height: 50, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, flexShrink: 0 },
});
