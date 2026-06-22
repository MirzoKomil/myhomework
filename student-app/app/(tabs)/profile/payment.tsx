import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { paymentHistory, profileStats } from '@/data/mock';

export default function PaymentScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="To'lovlar" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.tariffCard}>
          <Text style={styles.tariffLabel}>Joriy tarif</Text>
          <Text style={styles.tariffName}>{profileStats.tariff}</Text>
          <Text style={styles.tariffPrice}>450 000 UZS / oy</Text>
        </Card>

        <Text style={styles.sectionTitle}>To'lov tarixi</Text>
        {paymentHistory.map((payment) => (
          <Card key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentDate}>{payment.date}</Text>
                <Text style={styles.paymentTariff}>{payment.tariff}</Text>
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>
                  {payment.amount.toLocaleString('uz-UZ')} UZS
                </Text>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>To'langan</Text>
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20 },
  tariffCard: { marginBottom: 24, backgroundColor: theme.colors.purpleLight },
  tariffLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.purple },
  tariffName: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text, marginTop: 4 },
  tariffPrice: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, marginBottom: 12 },
  paymentCard: { marginBottom: 10 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentDate: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  paymentTariff: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  paidBadge: {
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  paidText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.success },
});
