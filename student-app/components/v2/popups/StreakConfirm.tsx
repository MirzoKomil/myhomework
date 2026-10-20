/**
 * "Streak himoyasini sotib olasizmi?" (dizayn: 81 · Popup · Streak himoyasi — tasdiqlash).
 *
 * Do'kondagi "Ilova bonusi → 150" tugmasidan ochiladi, "Tasdiqlash" →
 * OrderSuccess. Balans — haqiqiy coinsStore. Streak himoyasi serverda
 * YO'Q (streak kuzatilmaydi), shuning uchun tasdiqlash coin yechmaydi —
 * keyingi oyna (OrderSuccess) "Namuna" belgisisiz ochiladi. Coin
 * yetmasa tugma ShopItem'dagidek qulflangan holatda bo'ladi.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { LockIcon, ShieldIcon } from '@/components/v2/rewards/icons';
import { fmt } from '@/components/v2/rewards/parts';
import { BalanceValue, BottomSheet, InfoRows, PriceValue, RowLabel, SheetTop, sheetText } from '@/components/v2/rewards/sheet';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useCoins } from '@/services/coinsStore';
import { DStreakConfirmCard } from '@/components/v2/desktop/rewards/DPopups';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Props = { visible: boolean; price: number; onClose: () => void; onConfirm: () => void };

export function StreakConfirmPopup({ visible, price, onClose, onConfirm }: Props) {
  const coins = useCoins();
  const missing = Math.max(0, price - coins);
  const desktop = useIsDesktop();

  // Kompyuterda — markazdagi karta (D_StreakConfirm); mantiq bir xil.
  if (desktop) return <DStreakConfirmCard visible={visible} onClose={onClose} onConfirm={onConfirm} price={price} coins={coins} />;

  return (
    <BottomSheet visible={visible} onClose={onClose} labelledBy="Streak himoyasini sotib olasizmi?">
      <SheetTop onClose={onClose} />
      <View style={styles.head}>
        <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 130, height: 129 }} resizeMode="contain" />
        <Text accessibilityRole="header" style={[sheetText.title, { lineHeight: 29.9 }]}>Streak himoyasini sotib olasizmi?</Text>
      </View>

      <InfoRows
        minHeight={44}
        rows={[
          <>
            <RowLabel>Narxi</RowLabel>
            <PriceValue price={price} />
          </>,
          <>
            <RowLabel>Balans</RowLabel>
            <BalanceValue from={coins} to={coins - price} />
          </>,
        ]}
      />

      <View style={styles.note}>
        <View style={{ marginTop: 1 }}><ShieldIcon size={20} color="#1E3FD1" strokeWidth={2} /></View>
        <Text style={styles.noteText}>
          <Text style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>Bir marta ishlaydi:</Text> dars qoldirilgan kuni seriya saqlanadi.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {missing > 0 ? (
          <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={[styles.cta, { backgroundColor: '#E4E8F0' }]}>
            <LockIcon size={18} color="#4A5468" />
            <Text style={[styles.ctaText, { color: '#4A5468' }]}>{fmt(missing)} coin yetishmayapti</Text>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? '#1E3FD1' : '#2F5BFF' }]}>
            <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Tasdiqlash · {fmt(price)} coin</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>Bekor qilish</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8, marginTop: -34 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#E8EEFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  noteText: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20.3, color: '#26304A' },
  cta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
  cancel: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#1E3FD1' },
});
