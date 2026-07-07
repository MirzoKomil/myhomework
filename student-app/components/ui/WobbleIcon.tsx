import { ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function WobbleIcon({ active, children }: { active: boolean; children: ReactNode }) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(4400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, shake]);

  const rotate = shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-14deg', '0deg', '14deg', '0deg'] });

  return <Animated.View style={{ transform: [{ rotate }] }}>{children}</Animated.View>;
}
