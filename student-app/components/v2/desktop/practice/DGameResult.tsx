/**
 * Kompyuter: o'yin natijasi oynasi (GameResult'ning desktop varianti).
 *
 * Alohida D_ artboard yo'q — telefondagi karta mazmuni aynan saqlanadi
 * (natija, statistika, mukofot, "Yana oʻynash" / "Boshqa oʻyinlar"),
 * faqat o'yin sahifasi ustida markazda, xira + xiralashtirilgan fon bilan
 * (boshqa D_ popup'lar kabi). Ochilish vaqti va ovozli maqtov — telefondagidek.
 * Esc yoki fonni bosish — yopadi (o'yin taxtasi qoladi).
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { Bounce, Confetti, Pop } from '@/components/v2/motion';
import type { GameResultProps } from '@/components/v2/practice/GameResult';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { speak, stopVoice } from '@/services/voicePraise';

import { ICoin } from './ui';

const Bolt = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#7C4DFF" />
  </Svg>
);
const Close = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth={2.4} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export function DGameResult({ show, win, title, subtitle, stats, coins, lightning, newRecord, onAgain }: GameResultProps) {
  const [open, setOpen] = useState(false);
  // Telefondagi kabi: o'yin tugagach biroz kutib ochiladi (oxirgi yurish ko'rinsin).
  useEffect(() => {
    if (!show) {
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setOpen(true);
      speak(win ? 'gameWin' : 'gameLose', win ? 1550 : 1050);
    }, 700);
    return () => {
      clearTimeout(t);
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const close = () => setOpen(false);
  useDesktopKeys({ Escape: close }, open);

  const again = () => {
    setOpen(false);
    onAgain();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={st.root}>
        <Pressable accessibilityLabel="Yopish" onPress={close} style={[StyleSheet.absoluteFill, st.backdrop]} />
        <View accessibilityViewIsModal role="dialog" aria-modal style={st.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={close} style={st.close}>
            <Close />
          </Pressable>
          <View style={[st.hero, { backgroundColor: win ? '#E3F7EE' : '#FFF1E6' }]}>
            <Bounce height={win ? 14 : 4}>
              <Image source={designImages[win ? '81a355f68578bf95c65fc6772f9124c9' : '68633deaacf537e7e92265a39c0e0949']} style={{ width: 150, height: 150 }} resizeMode="contain" />
            </Bounce>
          </View>
          {newRecord && (
            <Pop delay={300} style={st.recordChip}>
              <Text style={st.recordText}>Yangi rekord!</Text>
            </Pop>
          )}
          <Text accessibilityRole="header" style={st.title}>
            {title}
          </Text>
          {!!subtitle && <Text style={st.sub}>{subtitle}</Text>}

          {stats.length > 0 && (
            <View style={st.stats}>
              {stats.map((x) => (
                <View key={x.label} style={st.stat}>
                  <Text style={st.statVal}>{x.value}</Text>
                  <Text style={st.statLabel}>{x.label}</Text>
                </View>
              ))}
            </View>
          )}

          {(coins > 0 || lightning > 0) && (
            <View style={st.rewards} accessibilityLabel={`Mukofot: ${coins} coin, ${lightning} chaqmoq`}>
              <Text style={st.rewardLabel}>Mukofot</Text>
              <View style={{ flex: 1 }} />
              {coins > 0 && (
                <View style={st.rewardItem}>
                  <ICoin />
                  <Text style={[st.rewardVal, { color: '#7A5300' }]}>+{coins}</Text>
                </View>
              )}
              {lightning > 0 && (
                <View style={st.rewardItem}>
                  <Bolt />
                  <Text style={[st.rewardVal, { color: '#5A2FD6' }]}>+{lightning}</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                router.replace(R.practice as Href);
              }}
              style={st.secondary}
            >
              <Text style={st.secondaryText}>Boshqa oʻyinlar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={again} style={({ pressed }) => [st.primary, pressed && { transform: [{ translateY: 3 }] }]}>
              <Text style={st.primaryText}>Yana oʻynash</Text>
            </Pressable>
          </View>
        </View>
        {open && win && <Confetti count={34} />}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.55)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  card: {
    width: 460,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    gap: 14,
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  } as object,
  close: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { height: 170, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recordChip: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF4D1' },
  recordText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.8, color: '#7A5300', textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: '#0B1220', textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#4A5468', textAlign: 'center', marginTop: -6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 22, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  rewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D5DBE7',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
  },
  rewardLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, color: '#34405A' },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17 },
  primary: {
    flex: 1,
    height: 54,
    borderRadius: 17,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  primaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
  secondary: { flex: 1, height: 54, borderRadius: 17, borderWidth: 2, borderColor: '#E2E6EE', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#1E3FD1' },
});
