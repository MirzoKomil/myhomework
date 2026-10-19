/**
 * v2 Faol qurilmalar (dizayn: 57 · Devices).
 *
 * Eski ekran namuna ro'yxat ko'rsatardi; endi serverdagi haqiqiy
 * sessiyalar (`/api/auth/sessions`) chiqadi. Serverda shahar aniqlanmaydi,
 * shuning uchun joylashuv qatorida sessiyaning IP manzili ko'rsatiladi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClockIcon, LaptopIcon, PhoneIcon, PinIcon, ShieldAlertIcon } from '@/components/v2/settings/icons';
import { Column, ScreenHeader, SUPPORT_TELEGRAM_URL, TelegramButton } from '@/components/v2/settings/parts';
import { fetchSessions, lastSeenLabel, parseUserAgent, type DeviceSession } from '@/components/v2/settings/sessions';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

export default function V2Devices() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchSessions().then(setSessions).catch(() => setSessions([]));
    }, []),
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Column style={styles.fill}>
          <ScreenHeader
            title="Faol qurilmalar"
            subtitle={`Hisobingizga kirilgan ${sessions.length} ta qurilma`}
            fallback={R.settings}
          />
          <View style={styles.body}>
            <View accessibilityRole="list" style={styles.list}>
              {sessions.map((s) => {
                const d = parseUserAgent(s.userAgent);
                return (
                  <View key={s.id} style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: s.isCurrent ? '#E8EEFF' : '#EEF1F7' }]}>
                      {d.mobile ? (
                        <PhoneIcon size={24} color={s.isCurrent ? '#1E3FD1' : '#4A5468'} />
                      ) : (
                        <LaptopIcon color={s.isCurrent ? '#1E3FD1' : '#4A5468'} />
                      )}
                    </View>
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{d.name}</Text>
                        {s.isCurrent && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Shu qurilma</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.kind}>{d.kind}</Text>
                      {!!s.ip && (
                        <View style={[styles.meta, { marginTop: 4 }]}>
                          <PinIcon />
                          <Text style={styles.metaText}>{s.ip}</Text>
                        </View>
                      )}
                      {s.isCurrent ? (
                        <View style={styles.meta}>
                          <View style={styles.dot} />
                          <Text style={styles.activeText}>Hozir faol</Text>
                        </View>
                      ) : (
                        <View style={styles.meta}>
                          <ClockIcon />
                          <Text style={styles.metaText}>{lastSeenLabel(s.lastSeen)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.warn}>
              <View style={styles.warnRow}>
                <View style={{ marginTop: 1 }}>
                  <ShieldAlertIcon />
                </View>
                <View style={styles.warnTexts}>
                  <Text style={styles.warnTitle}>Notanish qurilma koʻrsangiz, menejerga yozing</Text>
                  <Text style={styles.warnBody}>
                    Menejer parolingizni yangilab, notanish qurilmani hisobdan chiqaradi. Login va parolni hech kimga bermang.
                  </Text>
                </View>
              </View>
              <TelegramButton label="Menejerga yozish" url={SUPPORT_TELEGRAM_URL} height={48} radius={14} fontSize={14} />
            </View>

            <View style={styles.mascotWrap}>
              <Image
                source={designImages['f1f2b5015be3aab0bfaac974e1e01af0']}
                resizeMode="contain"
                style={styles.mascot}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  scroll: { flexGrow: 1 },
  fill: { flex: 1 },
  body: { flex: 1, paddingTop: 16, paddingHorizontal: 20, gap: 12 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#0B1220' },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#E3F7EE', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#075E3A' },
  kind: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0FA968' },
  activeText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#087A4A' },
  warn: { backgroundColor: '#FFF4D1', borderRadius: 20, padding: 14, gap: 12 },
  warnRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  warnTexts: { flex: 1, gap: 3 },
  warnTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 21, color: '#0B1220' },
  warnBody: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.2, color: '#4A5468' },
  mascotWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  mascot: { width: 170, height: 170 },
});
