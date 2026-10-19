/**
 * v2 animatsiya bloklari (react-native-reanimated).
 *
 * Qoida: har bir animatsiyaning OXIRGI holati dizayndagi statik ko'rinishning
 * aynan o'zi — animatsiya faqat u yerga qanday yetib kelishni ko'rsatadi.
 * Tizimda "harakatni kamaytirish" (Reduce motion) yoqilgan bo'lsa,
 * hamma narsa darhol yakuniy holatda chiziladi.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const ease = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Ekran / karta paydo bo'lishi: pastdan 12px ko'tarilib, xiralikdan chiqadi. */
export function FadeInUp({
  children,
  delay = 0,
  distance = 12,
  duration = 360,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: ease.out }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * distance }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Pastdan chiqadigan panel (javob natijasi, bottom sheet). */
export function SlideUp({ children, style, distance = 80 }: { children: ReactNode; style?: StyleProp<ViewStyle>; distance?: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withSpring(1, { damping: 18, stiffness: 220, mass: 0.8 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6), transform: [{ translateY: (1 - p.value) * distance }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Paydo bo'lganda "sakrab" kattalashadi (belgi, nishon, mascot). */
export function Pop({
  children,
  delay = 0,
  from = 0.4,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(reduce ? 1 : from);
  const op = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    op.value = withDelay(delay, withTiming(1, { duration: 140 }));
    sc.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 260, mass: 0.7 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Xato javobda yonma-yon silkinish. `trigger` o'zgarganda (yoki mount'da) ishlaydi. */
export function Shake({ children, trigger = 0, style }: { children: ReactNode; trigger?: number | string | boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    x.value = withSequence(
      withTiming(-9, { duration: 50 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** "+1" coin yoki "+40" chaqmoq — yuqoriga suzib chiqib, so'nadi; keyin joyida qoladi. */
export function FloatUp({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.4),
    transform: [{ translateY: (1 - p.value) * 14 }, { scale: 0.7 + 0.3 * p.value }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/**
 * Coin "uchib ketishi": ustiga qo'yiladigan nusxa yuqoriga ko'tarilib so'nadi
 * (asl element joyida qoladi). Faqat bezak — ekran o'quvchisidan yashirin.
 */
export function CoinGhost({ children, play, rise = 46 }: { children: ReactNode; play: boolean; rise?: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!play || reduce) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 700, easing: ease.out });
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [{ translateY: -rise * p.value }, { scale: 1 + 0.35 * p.value }],
  }));
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, a]}>
      {children}
    </Animated.View>
  );
}

/** Kenglik foizini silliq o'zgartiradigan chiziq (progress bar ichi). */
export function AnimatedFill({
  pct,
  color,
  height,
  radius,
  delay = 0,
  fromZero = false,
}: {
  pct: number;
  color: string;
  height: number;
  radius: number;
  delay?: number;
  /** Mount'da 0 dan to'ladi (natija ekranlari); aks holda faqat o'zgarishda harakatlanadi. */
  fromZero?: boolean;
}) {
  const reduce = useReducedMotion();
  const w = useSharedValue(fromZero && !reduce ? 0 : pct);
  useEffect(() => {
    if (reduce) {
      w.value = pct;
      return;
    }
    w.value = withDelay(delay, withTiming(pct, { duration: 520, easing: ease.out }));
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, w.value))}%` }));
  return <Animated.View style={[{ height, borderRadius: radius, backgroundColor: color }, a]} />;
}

/** Raqam 0 dan (yoki `from` dan) qiymatgacha sanaladi: "+28 coin", "472". */
export function CountUp({
  value,
  from = 0,
  duration = 900,
  delay = 0,
  prefix = '',
  suffix = '',
  format = (n: number) => String(n),
  style,
}: {
  value: number;
  from?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : from);
  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const startVal = from;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const k = Math.min(1, (ts - start) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        setN(Math.round(startVal + (value - startVal) * e));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Text style={style}>{`${prefix}${format(n)}${suffix}`}</Text>;
}

/** Streak olovi: yengil "lipillash" (doimiy, juda nozik). */
export function Flicker({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    s.value = withRepeat(withSequence(withTiming(1.08, { duration: 420, easing: ease.inOut }), withTiming(0.97, { duration: 380, easing: ease.inOut })), -1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Domik / mascot: paydo bo'lganda bir-ikki sakraydi. */
export function Bounce({ children, delay = 0, style, height = 14 }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; height?: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const sc = useSharedValue(reduce ? 1 : 0.6);
  useEffect(() => {
    if (reduce) return;
    sc.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 200 }));
    y.value = withDelay(
      delay + 120,
      withSequence(
        withTiming(-height, { duration: 220, easing: ease.out }),
        withTiming(0, { duration: 260, easing: Easing.bounce }),
        withTiming(-height * 0.4, { duration: 160, easing: ease.out }),
        withTiming(0, { duration: 200, easing: Easing.bounce }),
      ),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: sc.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

const CONFETTI_COLORS = ['#2F5BFF', '#FFC93C', '#FF7A1A', '#087A4A', '#7B61FF', '#FF5C8A', '#2AABEE'];

type Piece = { x: number; delay: number; dur: number; rot: number; drift: number; w: number; h: number; color: string; round: boolean };

function makePieces(count: number, seed: number): Piece[] {
  let r = seed;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  return Array.from({ length: count }, () => ({
    x: rnd(),
    delay: rnd() * 260,
    dur: 1500 + rnd() * 900,
    rot: (rnd() - 0.5) * 720,
    drift: (rnd() - 0.5) * 80,
    w: 6 + rnd() * 6,
    h: 8 + rnd() * 8,
    color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
    round: rnd() > 0.7,
  }));
}

function ConfettiPiece({ p, height, width }: { p: Piece; height: number; width: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: Easing.in(Easing.quad) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
    transform: [
      { translateX: p.x * width + p.drift * t.value },
      { translateY: -20 + (height + 40) * t.value },
      { rotate: `${p.rot * t.value}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: p.w, height: p.round ? p.w : p.h, borderRadius: p.round ? p.w / 2 : 2, backgroundColor: p.color }, a]} />;
}

/** Bir martalik konfetti yomg'iri (dars tugadi, yangi daraja). Bezak — bosishlarni to'smaydi. */
export function Confetti({ count = 46, width = 390, height = 844, seed = 7 }: { count?: number; width?: number; height?: number; seed?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => makePieces(count, seed), [count, seed]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 50 }]}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} p={p} width={width} height={height} />
      ))}
    </View>
  );
}

/** Bosilganda yengil kichrayish (Pressable ichidagi kontent uchun). */
export function usePressScale(pressed: boolean) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    s.value = withTiming(pressed ? 0.97 : 1, { duration: pressed ? 80 : 160 });
  }, [pressed]); // eslint-disable-line react-hooks/exhaustive-deps
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

export { Animated };
