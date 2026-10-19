/**
 * Mukofotlar guruhi popup'lari uchun umumiy pastki varaq (bottom sheet):
 * dizayndagi oq varaq (30px yuqori burchak, tutqich, soya), "Namuna"
 * belgisi va Narxi/Balans qatorlari. Dizayndagi fon — ostidagi ekranning
 * xiralashtirilgan surati; bu yerda varaq haqiqiy ekran ustida ochiladi
 * va fon qorong'ilashtirilib xiralashtiriladi.
 */
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/v2/tokens';

import { CloseIcon, CoinFill, EyeIcon, SmallArrowIcon } from './icons';
import { fmt } from './parts';

export function BottomSheet({
  visible,
  onClose,
  children,
  paddingBottom = 30,
  labelledBy,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  paddingBottom?: number;
  labelledBy?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View accessibilityViewIsModal accessibilityLabel={labelledBy} style={[styles.sheet, { paddingBottom: insets.bottom + paddingBottom }]}>
          <View style={styles.column}>
            <View style={styles.handle} />
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Varaq tepasidagi qator: chapda (ixtiyoriy) "Namuna" belgisi, o'ngda yopish tugmasi. */
export function SheetTop({ sample, onClose }: { sample?: string; onClose: () => void }) {
  return (
    <View style={[styles.top, { justifyContent: sample ? 'space-between' : 'flex-end' }]}>
      {sample ? <SampleChip label={sample} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: 0.75 }]}>
        <CloseIcon />
      </Pressable>
    </View>
  );
}

export function SampleChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <EyeIcon />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

/** Kulrang quti ichidagi qatorlar (Narxi / Balans / Holati). */
export function InfoRows({ rows, minHeight }: { rows: ReactNode[]; minHeight: number }) {
  return (
    <View style={styles.rows}>
      {rows.map((r, i) => (
        <View key={i} style={[styles.row, { minHeight: minHeight + (i < rows.length - 1 ? 1 : 0) }, i < rows.length - 1 && styles.rowBorder]}>
          {r}
        </View>
      ))}
    </View>
  );
}

export function RowLabel({ children }: { children: string }) {
  return <Text style={styles.rowLabel}>{children}</Text>;
}

/** "−150 (coin) coin" — qizil narx. */
export function PriceValue({ price }: { price: number }) {
  return (
    <View style={styles.valueRow}>
      <Text style={[styles.value, { color: '#B42318' }]}>−{fmt(price)}</Text>
      <CoinFill size={16} />
      <Text style={[styles.value, { color: '#B42318' }]}>coin</Text>
    </View>
  );
}

/** "486 → (coin) 336 coin" — eski balans (ixtiyoriy chizilgan) va yangisi. */
export function BalanceValue({ from, to, strike }: { from: number; to: number; strike?: boolean }) {
  return (
    <View style={styles.valueRow} accessible accessibilityLabel={`${fmt(from)} dan ${fmt(to)} coin`}>
      <Text style={[styles.value, styles.old, strike && { textDecorationLine: 'line-through' }]}>{fmt(from)}</Text>
      <SmallArrowIcon />
      <CoinFill size={16} />
      <Text style={styles.value}>{fmt(to)} coin</Text>
    </View>
  );
}

export const sheetText = StyleSheet.create({
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, letterSpacing: -0.52, color: '#0B1220', textAlign: 'center' },
  body: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, lineHeight: 21.75, color: '#4A5468', textAlign: 'center' },
  value: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.45)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as object) : null),
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 14 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', marginTop: -10 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  rows: { backgroundColor: '#F4F6FA', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#E4E8F0' },
  rowLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, color: '#4A5468' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  value: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  old: { fontFamily: fonts.bodyBold, color: '#4A5468' },
});
