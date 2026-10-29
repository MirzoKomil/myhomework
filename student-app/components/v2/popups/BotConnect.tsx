/**
 * "Telegram botni ulang" pastki oynasi (dizayn: BotConnect.dc.html).
 *
 * Ulash mantig'i eski `app/(tabs)/profile/telegram.tsx` bilan bir xil
 * (services/telegramLinkApi): "Botni ochish" bir martalik havola yaratib
 * Telegramda ochadi, oyna ochiq turganda holat har 4 soniyada tekshiriladi.
 * Server o'quvchi o'z Telegram hisobini ilovada tasdiqlashini talab qiladi —
 * shuning uchun "claimed" holatida asosiy tugma "Tasdiqlash"ga aylanadi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DBotConnect } from '@/components/v2/desktop/home/DBotConnect';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { ChipBellIcon, ChipCheckIcon, ChipVideoIcon, CloseIcon, TelegramAltIcon } from '@/components/v2/home/icons';
import { BOT_URL } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import {
  confirmTelegramLink,
  createTelegramLink,
  telegramLinkStatus,
  type TelegramLinkStatus,
} from '@/services/telegramLinkApi';

const STEPS = ['«Botni ochish»ni bosing', 'Telegramda Start tugmasini bosing — tamom!'];

// mandatory — o'quvchi botni ulamaguncha oyna yopilmaydi (admin kampaniyasi, server `mandatory` deydi).
export function BotConnectPopup(props: { visible: boolean; onClose: () => void; mandatory?: boolean }) {
  // Kompyuterda — markazdagi karta (D_BotConnect), telefonda — pastki oyna.
  return useIsDesktop() ? <DBotConnect {...props} /> : <BotConnectPopupMobile {...props} />;
}

function BotConnectPopupMobile({ visible, onClose, mandatory = false }: { visible: boolean; onClose: () => void; mandatory?: boolean }) {
  const dismiss = mandatory ? () => {} : onClose;
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  // "Jonli darsga havola (19:00)" — o'quvchining haqiqiy dars vaqti (jadvaldan).
  const [lessonTime, setLessonTime] = useState('');
  useEffect(() => {
    if (!visible || !token) return;
    fetchDemoSchedule()
      .then((s) => {
        const t = s.startsAt ? new Date(s.startsAt) : null;
        setLessonTime(t ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : (s.lessonTime || ''));
      })
      .catch(() => {});
  }, [visible, token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const s = await telegramLinkStatus();
      if (alive.current) setStatus(s);
    } catch {
      // Holatni tekshirib bo'lmasa — keyingi urinishda qayta so'raymiz.
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    if (!visible) return;
    setError('');
    void load();
    const id = setInterval(load, 4000);
    const sub = AppState.addEventListener('change', (v) => { if (v === 'active') void load(); });
    return () => { alive.current = false; clearInterval(id); sub.remove(); };
  }, [visible, load]);

  // Ulangach oyna o'zi yopiladi — bosh sahifa "bot ulangan" holatiga o'tadi.
  useEffect(() => {
    if (visible && status?.linked) onClose();
  }, [visible, status?.linked, onClose]);

  const req = status?.request;
  const claimed = !!req && !req.expired && req.state === 'claimed' && !!req.telegram;

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Telegram ulanishida xatolik'); }
    finally { if (alive.current) setBusy(false); }
  };

  const openBot = () =>
    run(async () => {
      if (!token) { await Linking.openURL(BOT_URL); return; }
      const r = await createTelegramLink();
      await Linking.openURL(r.url);
      await load();
    });

  const confirm = () =>
    run(async () => {
      if (!req) return;
      await confirmTelegramLink(req);
      await load();
    });

  let statusText = 'Ulanish kutilmoqda…';
  if (claimed) statusText = `${req!.telegram!.name || 'Telegram'} — tasdiqlang`;
  if (error) statusText = error;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Yopish" onPress={dismiss} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View style={styles.column}>
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 8) }]}>
            <ScrollView bounces={false} contentContainerStyle={styles.sheetInner} showsVerticalScrollIndicator={false}>
              <View style={styles.grip} />
              <View style={styles.head}>
                <Image
                  source={designImages.ea02e684d881c58fa4cba7467756a2c8}
                  accessibilityLabel="Qoʻngʻiroqcha chalayotgan Domik"
                  style={styles.mascot}
                  resizeMode="contain"
                />
                <View style={styles.headText}>
                  <Text style={styles.title} accessibilityRole="header">Telegram botni ulang</Text>
                  <Text style={styles.handle}>@Domworkuz_bot</Text>
                </View>
                {!mandatory && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={styles.close}>
                    <CloseIcon />
                  </Pressable>
                )}
              </View>
              <Text style={styles.body}>{mandatory
                ? 'Davom etish uchun botni ulang — 30 soniyalik ish. Muhim xabarlar Telegramga keladi, hech narsani oʻtkazib yubormaysiz.'
                : 'Muhim xabarlar Telegramga keladi — ilovani ochmasangiz ham hech narsani oʻtkazib yubormaysiz.'}</Text>
              <View style={styles.list} accessibilityRole="list">
                <View style={styles.item}><ChipBellIcon size={18} color="#1B6FA8" /><Text style={styles.itemText}>Darsdan oldin eslatma</Text></View>
                <View style={styles.item}><ChipVideoIcon size={18} color="#1B6FA8" /><Text style={styles.itemText}>{lessonTime ? `Jonli darsga havola (${lessonTime})` : 'Jonli darsga havola'}</Text></View>
                <View style={styles.item}><ChipCheckIcon size={18} color="#1B6FA8" /><Text style={styles.itemText}>Baho va vazifa natijalari</Text></View>
              </View>
              <View style={styles.steps}>
                {STEPS.map((s, i) => (
                  <View key={s} style={styles.step}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                    <Text style={styles.stepText}>
                      {i === 1 ? <>Telegramda <Text style={{ fontFamily: fonts.bodyHeavy }}>Start</Text> tugmasini bosing — tamom!</> : s}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.statusRow} accessibilityLiveRegion="polite">
                <View style={[styles.statusDot, !!error && { backgroundColor: '#D92D20', boxShadow: '0 0 0 4px #FDECEC' }]} />
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy, disabled: busy }}
                  onPress={claimed ? confirm : openBot}
                  style={({ pressed }) => [styles.primary, (pressed || busy) && { backgroundColor: '#1E96D4' }]}
                >
                  <TelegramAltIcon />
                  <Text style={styles.primaryText}>{claimed ? 'Ha, bu mening Telegramim' : 'Botni ochish'}</Text>
                </Pressable>
                {!mandatory && (
                  <Pressable accessibilityRole="button" onPress={onClose} style={styles.later}>
                    <Text style={styles.laterText}>Keyinroq</Text>
                  </Pressable>
                )}
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
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
  },
  sheetInner: { gap: 14 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mascot: { width: 92, height: 93, marginTop: -4 },
  headText: { flex: 1, gap: 4, paddingTop: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26.4, letterSpacing: -0.48, color: '#0B1220', fontWeight: 'normal' },
  handle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#1B6FA8', fontWeight: 'normal' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: '#4A5468', fontWeight: 'normal' },
  list: { marginTop: -2, paddingHorizontal: 2, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18.9, color: '#0B1220', fontWeight: 'normal' },
  steps: { backgroundColor: '#F4F6FA', borderRadius: 20, padding: 14, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFFFFF', fontWeight: 'normal' },
  stepText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19.6, color: '#0B1220', fontWeight: 'normal' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFC93C', boxShadow: '0 0 0 4px #FFF4D1' },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#4A5468', fontWeight: 'normal', flexShrink: 1 },
  actions: { gap: 6 },
  primary: { height: 56, borderRadius: 18, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  later: { height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#4A5468', fontWeight: 'normal' },
});
