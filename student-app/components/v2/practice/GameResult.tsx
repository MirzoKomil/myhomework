/**
 * O'yin tugagach chiqadigan natija oynasi (Esla-mosla, So'ztopar,
 * Sirli so'z, So'nggi harf).
 *
 * Sabab: o'yin tugaganda faqat pastdagi kichik yozuv o'zgarardi —
 * o'quvchi yutganini, nima olganini va keyin nima qilishini sezmasdi.
 * Endi: natija, olingan coin/chaqmoq, rekord va 2 ta keyingi qadam
 * ("Yana oʻynash" / "Boshqa oʻyinlar"). Yopilsa — o'yin taxtasi qoladi.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Bounce, Confetti, Pop } from '@/components/v2/motion';
import { speak } from '@/services/voicePraise';

import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

export type ResultStat = { value: string; label: string };

type Props = {
  /** O'yin tugadimi (true bo'lgach biroz kutib ochiladi — oxirgi yurish ko'rinsin). */
  show: boolean;
  win: boolean;
  title: string;
  subtitle?: string;
  stats: ResultStat[];
  coins: number;
  lightning: number;
  /** Yangi rekord o'rnatildimi. */
  newRecord?: boolean;
  onAgain: () => void;
};

const Coin = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
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

export function GameResult({ show, win, title, subtitle, stats, coins, lightning, newRecord, onAgain }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!show) {
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setOpen(true);
      speak(win ? 'gameWin' : 'gameLose', win ? 1550 : 1050);
    }, 700);
    return () => clearTimeout(t);
  }, [show]);

  const again = () => {
    setOpen(false);
    onAgain();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <View style={st.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={st.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => setOpen(false)} style={st.close}>
            <Close />
          </Pressable>
          <View style={[st.hero, { backgroundColor: win ? '#E3F7EE' : '#FFF1E6' }]}>
            <Bounce height={win ? 14 : 4}>
              <Image
                source={designImages[win ? '81a355f68578bf95c65fc6772f9124c9' : '68633deaacf537e7e92265a39c0e0949']}
                style={{ width: 132, height: 132 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
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
              {stats.map((s) => (
                <View key={s.label} style={st.stat}>
                  <Text style={st.statVal}>{s.value}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
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
                  <Coin />
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

          <Pressable accessibilityRole="button" onPress={again} style={({ pressed }) => [st.primary, pressed && { transform: [{ translateY: 3 }] }]}>
            <Text style={st.primaryText}>Yana oʻynash</Text>
          </Pressable>
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
        </View>
        {open && win && <Confetti count={34} />}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,18,32,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 20,
    paddingTop: 20,
    alignItems: 'stretch',
    gap: 12,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { height: 150, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recordChip: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF4D1' },
  recordText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.8, color: '#7A5300', textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: '#0B1220', textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, lineHeight: 21, color: '#4A5468', textAlign: 'center', marginTop: -6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 20, color: '#0B1220' },
  statLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  rewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D5DBE7',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  rewardLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, color: '#34405A' },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
  primary: {
    marginTop: 4,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  primaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#FFFFFF' },
  secondary: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#1E3FD1' },
});
