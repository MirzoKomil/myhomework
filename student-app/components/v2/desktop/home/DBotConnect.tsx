/**
 * Kompyuter: "Telegram botni ulang" oynasi (dizayn: D_BotConnect).
 * Ulash mantig'i mobil BotConnect bilan aynan bir xil (telegramLinkApi):
 * "Botni ochish" bir martalik havola yaratadi, oyna ochiqligida holat har
 * 4 soniyada tekshiriladi, "claimed" holatida tasdiqlash tugmasi; ulangach yopiladi.
 * QR — server bergan shaxsiy bir martalik havola (telefon raqami mos kelishi shart emas);
 * oyna ochilganda yaratiladi, muddati tugasa yangilanadi. Kirmagan bo'lsa — botning oddiy manzili.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { BOT_URL } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useAuth } from '@/services/studentAuthStore';
import { confirmTelegramLink, createTelegramLink, telegramLinkStatus, type TelegramLinkCreated, type TelegramLinkStatus } from '@/services/telegramLinkApi';

import { DPopupFrame } from './DPopupFrame';
import { ChipBellIcon, ChipCheckIcon, ChipVideoIcon, CloseIcon, TgIcon } from './icons';


export function DBotConnect({ visible, onClose, mandatory = false }: { visible: boolean; onClose: () => void; mandatory?: boolean }) {
  const dismiss = mandatory ? () => {} : onClose;
  const { token } = useAuth();
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<TelegramLinkCreated | null>(null);
  const alive = useRef(true);
  const creating = useRef(false);

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
  const linkLive = !!link && new Date(link.request.expiresAt).getTime() > Date.now() + 15000
    && (!req || req.id !== link.request.id || req.state === 'pending' || req.state === 'claimed');

  // Oyna ochiq va hali ulanmagan bo'lsa — QR uchun shaxsiy havola tayyorlab qo'yamiz (muddati o'tsa yangisi).
  useEffect(() => {
    if (!visible || !token || status?.linked || claimed || linkLive || creating.current || error) return;
    creating.current = true;
    createTelegramLink()
      .then((r) => { if (alive.current) setLink(r); })
      .catch((e) => { if (alive.current) setError(e instanceof Error ? e.message : 'Telegram ulanishida xatolik'); })
      .finally(() => { creating.current = false; });
  }, [visible, token, status?.linked, claimed, linkLive, error]);

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
      const r = linkLive && link ? link : await createTelegramLink();
      setLink(r);
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
    <DPopupFrame visible={visible} onClose={dismiss} width={560}>
      <View style={s.head}>
        <Image source={designImages.ea02e684d881c58fa4cba7467756a2c8} accessibilityLabel="Qoʻngʻiroqcha chalayotgan Domik" style={s.mascot} resizeMode="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={s.title}>
            Telegram botni ulang
          </Text>
          <Text style={s.handle}>@Domworkuz_bot</Text>
        </View>
        {!mandatory && (<Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
          <CloseIcon />
        </Pressable>)}
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
              Telegramda <Text style={{ fontFamily: fonts.bodyHeavy }}>Start</Text> tugmasini bosing — tamom, oyna o‘zi yopiladi
            </Text>,
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
            {link?.qr && linkLive ? (
              <Svg width={132} height={132} viewBox={`-2 -2 ${link.qr.size + 4} ${link.qr.size + 4}`} accessibilityLabel="@Domworkuz_bot ulash QR kodi" {...({ shapeRendering: 'crispEdges' } as object)}>
                <Rect x={-2} y={-2} width={link.qr.size + 4} height={link.qr.size + 4} fill="#FFFFFF" />
                <Path d={link.qr.path} fill="#0B1220" />
              </Svg>
            ) : (
              <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={s.qrCaption}>{!token ? 'Avval ilovaga kiring' : error ? 'QR tayyor emas' : 'QR tayyorlanmoqda…'}</Text>
              </View>
            )}
          </View>
          <Text style={s.qrCaption}>Telefon kamerasi bilan</Text>
        </View>
      </View>
      <View style={s.footer}>
        <View style={s.status} accessibilityLiveRegion="polite">
          <View style={[s.statusDot, !!error && { backgroundColor: '#D92D20', boxShadow: '0 0 0 4px #FDECEC' }]} />
          <Text style={s.statusText}>{statusText}</Text>
        </View>
        {!mandatory && (<Pressable accessibilityRole="button" onPress={onClose} style={s.later}>
          <Text style={s.laterText}>Keyinroq</Text>
        </Pressable>)}
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
