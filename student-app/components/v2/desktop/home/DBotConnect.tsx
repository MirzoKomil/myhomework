/**
 * Kompyuter: "Telegram botni ulang" oynasi (dizayn: D_BotConnect).
 * Ulash mantig'i mobil BotConnect bilan aynan bir xil (telegramLinkApi):
 * "Botni ochish" bir martalik havola yaratadi, oyna ochiqligida holat har
 * 4 soniyada tekshiriladi, "claimed" holatida tasdiqlash tugmasi; ulangach yopiladi.
 * QR — dizayndagi kod (@Domworkuz_bot manzili: https://t.me/Domworkuz_bot).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { BOT_URL } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useAuth } from '@/services/studentAuthStore';
import { confirmTelegramLink, createTelegramLink, telegramLinkStatus, type TelegramLinkStatus } from '@/services/telegramLinkApi';

import { DPopupFrame } from './DPopupFrame';
import { ChipBellIcon, ChipCheckIcon, ChipVideoIcon, CloseIcon, TgIcon } from './icons';

const QR_PATH = 'M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM9 0h1v1h-1zM13 0h1v1h-1zM14 0h1v1h-1zM15 0h1v1h-1zM18 0h1v1h-1zM19 0h1v1h-1zM20 0h1v1h-1zM21 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM14 1h1v1h-1zM15 1h1v1h-1zM16 1h1v1h-1zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM10 2h1v1h-1zM12 2h1v1h-1zM15 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM21 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM10 3h1v1h-1zM11 3h1v1h-1zM14 3h1v1h-1zM15 3h1v1h-1zM16 3h1v1h-1zM18 3h1v1h-1zM20 3h1v1h-1zM21 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM11 4h1v1h-1zM12 4h1v1h-1zM15 4h1v1h-1zM18 4h1v1h-1zM20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM10 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM13 7h1v1h-1zM15 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM10 8h1v1h-1zM11 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM16 8h1v1h-1zM20 8h1v1h-1zM23 8h1v1h-1zM1 9h1v1h-1zM2 9h1v1h-1zM4 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM24 9h1v1h-1zM0 10h1v1h-1zM3 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM12 10h1v1h-1zM13 10h1v1h-1zM14 10h1v1h-1zM17 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM23 10h1v1h-1zM24 10h1v1h-1zM1 11h1v1h-1zM11 11h1v1h-1zM13 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM18 11h1v1h-1zM23 11h1v1h-1zM0 12h1v1h-1zM1 12h1v1h-1zM3 12h1v1h-1zM5 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM9 12h1v1h-1zM11 12h1v1h-1zM12 12h1v1h-1zM13 12h1v1h-1zM15 12h1v1h-1zM16 12h1v1h-1zM17 12h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM24 12h1v1h-1zM1 13h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM10 13h1v1h-1zM11 13h1v1h-1zM13 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM17 13h1v1h-1zM18 13h1v1h-1zM21 13h1v1h-1zM24 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1zM9 14h1v1h-1zM12 14h1v1h-1zM16 14h1v1h-1zM17 14h1v1h-1zM19 14h1v1h-1zM22 14h1v1h-1zM23 14h1v1h-1zM24 14h1v1h-1zM1 15h1v1h-1zM2 15h1v1h-1zM4 15h1v1h-1zM5 15h1v1h-1zM10 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM14 15h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM20 15h1v1h-1zM23 15h1v1h-1zM0 16h1v1h-1zM2 16h1v1h-1zM3 16h1v1h-1zM4 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM7 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM13 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM21 16h1v1h-1zM8 17h1v1h-1zM9 17h1v1h-1zM10 17h1v1h-1zM12 17h1v1h-1zM14 17h1v1h-1zM15 17h1v1h-1zM16 17h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM0 18h1v1h-1zM1 18h1v1h-1zM2 18h1v1h-1zM3 18h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM13 18h1v1h-1zM14 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM21 18h1v1h-1zM23 18h1v1h-1zM24 18h1v1h-1zM0 19h1v1h-1zM6 19h1v1h-1zM10 19h1v1h-1zM12 19h1v1h-1zM13 19h1v1h-1zM16 19h1v1h-1zM20 19h1v1h-1zM21 19h1v1h-1zM23 19h1v1h-1zM24 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM3 20h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM9 20h1v1h-1zM10 20h1v1h-1zM11 20h1v1h-1zM12 20h1v1h-1zM16 20h1v1h-1zM17 20h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM0 21h1v1h-1zM2 21h1v1h-1zM3 21h1v1h-1zM4 21h1v1h-1zM6 21h1v1h-1zM12 21h1v1h-1zM14 21h1v1h-1zM16 21h1v1h-1zM19 21h1v1h-1zM20 21h1v1h-1zM21 21h1v1h-1zM22 21h1v1h-1zM0 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM6 22h1v1h-1zM8 22h1v1h-1zM10 22h1v1h-1zM12 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM20 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM9 23h1v1h-1zM13 23h1v1h-1zM14 23h1v1h-1zM15 23h1v1h-1zM16 23h1v1h-1zM20 23h1v1h-1zM21 23h1v1h-1zM23 23h1v1h-1zM0 24h1v1h-1zM1 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM8 24h1v1h-1zM9 24h1v1h-1zM12 24h1v1h-1zM13 24h1v1h-1zM16 24h1v1h-1zM17 24h1v1h-1zM18 24h1v1h-1zM19 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1z';

export function DBotConnect({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const st = await telegramLinkStatus();
      if (alive.current) setStatus(st);
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
    const sub = AppState.addEventListener('change', (v) => {
      if (v === 'active') void load();
    });
    return () => {
      alive.current = false;
      clearInterval(id);
      sub.remove();
    };
  }, [visible, load]);

  // Ulangach oyna o'zi yopiladi.
  useEffect(() => {
    if (visible && status?.linked) onClose();
  }, [visible, status?.linked, onClose]);

  const req = status?.request;
  const claimed = !!req && !req.expired && req.state === 'claimed' && !!req.telegram;

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Telegram ulanishida xatolik');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const openBot = () =>
    run(async () => {
      if (!token) {
        await Linking.openURL(BOT_URL);
        return;
      }
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
    <DPopupFrame visible={visible} onClose={onClose} width={560}>
      <View style={s.head}>
        <Image source={designImages.ea02e684d881c58fa4cba7467756a2c8} accessibilityLabel="Qoʻngʻiroqcha chalayotgan Domik" style={s.mascot} resizeMode="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={s.title}>
            Telegram botni ulang
          </Text>
          <Text style={s.handle}>@Domworkuz_bot</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
          <CloseIcon />
        </Pressable>
      </View>
      <Text style={s.body}>Muhim xabarlar Telegramga keladi — ilovani ochmasangiz ham hech narsani oʻtkazib yubormaysiz.</Text>
      <View accessibilityRole="list" style={s.chips}>
        <View style={s.chip}>
          <ChipBellIcon />
          <Text style={s.chipText}>Darsdan oldin eslatma</Text>
        </View>
        <View style={s.chip}>
          <ChipVideoIcon />
          <Text style={s.chipText}>Jonli dars havolasi</Text>
        </View>
        <View style={s.chip}>
          <ChipCheckIcon />
          <Text style={s.chipText}>Baho va natijalar</Text>
        </View>
      </View>
      <View style={s.steps}>
        <View style={{ flex: 1, gap: 12 }}>
          {[
            <Text key="1">Botni oching yoki QR kodni telefonda skanerlang</Text>,
            <Text key="2">
              <Text style={{ fontFamily: fonts.bodyHeavy }}>Start</Text> tugmasini bosing
            </Text>,
            <Text key="3">Telefon raqamingizni yuboring — ilova avtomatik ulanadi</Text>,
          ].map((t, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={s.qrCol}>
          <View style={s.qrBox}>
            <Svg width={132} height={132} viewBox="-2 -2 29 29" accessibilityLabel="@Domworkuz_bot QR kodi" {...({ shapeRendering: 'crispEdges' } as object)}>
              <Rect x={-2} y={-2} width={29} height={29} fill="#FFFFFF" />
              <Path d={QR_PATH} fill="#0B1220" />
            </Svg>
          </View>
          <Text style={s.qrCaption}>Telefon kamerasi bilan</Text>
        </View>
      </View>
      <View style={s.footer}>
        <View style={s.status} accessibilityLiveRegion="polite">
          <View style={[s.statusDot, !!error && { backgroundColor: '#D92D20', boxShadow: '0 0 0 4px #FDECEC' }]} />
          <Text style={s.statusText}>{statusText}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={s.later}>
          <Text style={s.laterText}>Keyinroq</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          onPress={claimed ? confirm : openBot}
          style={({ pressed }) => [s.primary, (pressed || busy) && { backgroundColor: '#1E96D4' }]}
        >
          <TgIcon size={19} />
          <Text style={s.primaryText}>{claimed ? 'Ha, bu mening Telegramim' : 'Botni ochish'}</Text>
        </Pressable>
      </View>
    </DPopupFrame>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mascot: { width: 96, height: 97, marginTop: -8, marginBottom: -6, marginLeft: -4 },
  title: T(fonts.display, 28, { lineHeight: 30.8, letterSpacing: -0.56, color: '#0B1220' }),
  handle: T(fonts.bodyHeavy, 15, { color: '#1B6FA8' }),
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  body: T(fonts.body, 15, { lineHeight: 22.5, color: '#4A5468' }),
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F6FA', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 },
  chipText: T(fonts.bodyBold, 14, { lineHeight: 18.2, color: '#0B1220', flexShrink: 1 }),
  steps: { backgroundColor: '#F4F6FA', borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 18 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  stepNumText: T(fonts.bodyHeavy, 14, { color: '#FFFFFF' }),
  stepText: T(fonts.bodyBold, 14, { flex: 1, lineHeight: 19.6, color: '#0B1220' }),
  qrCol: { alignItems: 'center', gap: 6 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, boxShadow: '0 0 0 1px #E2E6EE' },
  qrCaption: T(fonts.bodyBold, 12, { color: '#4A5468' }),
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFC93C', boxShadow: '0 0 0 4px #FFF4D1' },
  statusText: T(fonts.bodyBold, 14, { color: '#4A5468', flexShrink: 1 }),
  later: { height: 52, paddingHorizontal: 18, borderRadius: 17, justifyContent: 'center' },
  laterText: T(fonts.bodyHeavy, 15, { color: '#4A5468' }),
  primary: { height: 52, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryText: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
});
