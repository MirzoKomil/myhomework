import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useOrders } from '@/services/shopStore';

export default function ShopOrdersScreen() {
  const orders = useOrders();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Buyurtmalar" showBack />
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bag-handle-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Hali buyurtmalar yo'q</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <Card key={order.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{order.productName}</Text>
                  <Text style={styles.date}>{order.date} — qabul qilindi</Text>
                </View>
                <View style={styles.priceRow}>
                  <CoinIcon size={13} />
                  <Text style={styles.price}>{order.price}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  list: { padding: 20, gap: 10 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  date: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontFamily: theme.fonts.bold, fontSize: 13, color: '#B45309' },
});
