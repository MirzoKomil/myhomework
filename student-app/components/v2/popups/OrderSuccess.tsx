/**
 * "Streak himoyasi sotib olindi" (dizayn: 55 · Popup · xarid tasdiqlandi).
 *
 * StreakConfirm → "Tasdiqlash" dan keyin ochiladi. Streak himoyasi
 * serverda YO'Q — shuning uchun coin yechilmaydi ("Namuna" belgisi
 * o'quvchiga ko'rsatilmaydi — egasi qarori).
 * Narx va balans (hozirgi → narxdan keyingi) — haqiqiy coinsStore'dan.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { TICK2, TickIcon } from '@/components/v2/rewards/icons';
import { BalanceValue, BottomSheet, InfoRows, PriceValue, RowLabel, SheetTop, sheetText } from '@/components/v2/rewards/sheet';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useCoins } from '@/services/coinsStore';

type Props = { visible: boolean; price: number; onClose: () => void };

export function OrderSuccessPopup({ visible, price, onClose }: Props) {
  const coins = useCoins();
  // Dizayndagi "Doʻkonga qaytish" / "Yopish" — Shop'ga; oyna Shop ustida ochilgani uchun yopish kifoya.
  const back = onClose;

  return (
    <BottomSheet visible={visible} onClose={back} labelledBy="Streak himoyasi sotib olindi">
      <SheetTop onClose={back} />
      <View style={styles.head}>
        <View>
          <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 130, height: 129 }} resizeMode="contain" />
          <View style={styles.badge}><TickIcon size={16} color="#FFFFFF" strokeWidth={3.2} d={TICK2} /></View>
        </View>
        <View style={styles.okChip}><Text style={styles.okChipText}>Buyurtma tasdiqlandi</Text></View>
        <Text accessibilityRole="header" style={[sheetText.title, { lineHeight: 28.6 }]}>Streak himoyasi sotib olindi</Text>
        <Text style={sheetText.body}>Dars qoldirgan kuni seriyangiz avtomatik saqlanadi. Himoya bir marta ishlaydi.</Text>
      </View>

      <InfoRows
        minHeight={40}
        rows={[
          <>
            <RowLabel>Narxi</RowLabel>
            <PriceValue price={price} />
          </>,
          <>
            <RowLabel>Balans</RowLabel>
            <BalanceValue from={coins} to={coins - price} strike />
          </>,
          <>
            <RowLabel>Holati</RowLabel>
            <Text style={[sheetText.value, { color: '#087A4A' }]}>Faol · 1 dona</Text>
          </>,
        ]}
      />

      <Pressable accessibilityRole="link" onPress={back} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
        <Text style={styles.ctaText}>Doʻkonga qaytish</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8, marginTop: -4 },
  // Dizayn: 34×34 disk + 3px oq chegara (content-box) → tashqi 40×40.
  badge: { position: 'absolute', right: -2, bottom: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: '#087A4A', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  okChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#E3F7EE', justifyContent: 'center' },
  okChipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#075E3A' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
});
