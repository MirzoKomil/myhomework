import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

const COLORS = ['#7B61FF', '#F59E0B', '#22C55E', '#EF4444', '#4F8CFF', '#EC4899', '#FBBF24'];
const PIECE_COUNT = 26;

type Piece = { color: string; left: number; dx: number; rotateDeg: number; size: number };

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 140,
    rotateDeg: Math.random() * 720 - 360,
    size: 6 + Math.random() * 8,
  }));
}

// Duolingo uslubidagi qisqa "zo'r natija" bayrami — konfetti + olov nishon.
// Bir martalik (loop emas) animatsiya bo'lgani uchun 94/104-ish'da topilgan
// doimiy-loop Animated muammolariga duchor emas.
export function CelebrationOverlay({
  visible,
  message = "Zo'r!",
  onFinish,
}: {
  visible: boolean;
  message?: string;
  onFinish?: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => (visible ? makePieces() : []), [visible]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    badgeScale.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: false, friction: 5, tension: 80 }),
      Animated.delay(700),
      Animated.timing(badgeScale, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) onFinish?.();
    });
  }, [visible, progress, badgeScale, onFinish]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-20, 440] });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotateDeg}deg`] });
        const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 1.6,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.badgeText}>🔥 {message}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
  badgeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  badgeText: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: '#fff' },
});
