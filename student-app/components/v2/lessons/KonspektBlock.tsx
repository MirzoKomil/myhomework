/**
 * Dars konspekti — ochib-yopiladigan blok (slaydlar sahifasi tagida).
 * Kitob konspekti uzun: slayd ko'rishga xalaqit bermasligi uchun yopiq turadi,
 * o'quvchi kerak bo'lganda ochadi.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Konspekt } from '@/components/v2/library/Konspekt';
import { fonts } from '@/constants/v2/tokens';

export function KonspektBlock({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!text.trim()) return null;
  return (
    <View accessibilityLabel="Dars konspekti" style={st.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [st.head, pressed && { opacity: 0.8 }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.title}>Dars konspekti</Text>
          <Text style={st.sub}>{open ? 'Yopish uchun bosing' : 'Qoidalar va misollar — ochish uchun bosing'}</Text>
        </View>
        <Svg width={22} height={22} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Path d="M6 9l6 6 6-6" fill="none" stroke="#2F5BFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {open && (
        <View style={st.body}>
          <Konspekt text={text} bare />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  title: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  body: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#EEF1F7', paddingTop: 12 },
});
