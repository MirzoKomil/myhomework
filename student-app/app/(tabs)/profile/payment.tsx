import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { courseEnrollment, paymentHistory, profileStats } from '@/data/mock';
import { UZ_MONTHS } from '@/data/scheduleCalendar';
import { fetchDemoContract, getContractPdfUrl } from '@/services/contentApi';

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d}-${UZ_MONTHS[m - 1].toLowerCase()}, ${y}`;
}

export default function PaymentScreen() {
  const [contractNumber, setContractNumber] = useState(courseEnrollment.contractNumber);
  const debtEntry = paymentHistory.find((p) => p.status === 'debt');

  useEffect(() => {
    fetchDemoContract()
      .then((c) => {
        if (c.number) setContractNumber(c.number);
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="To'lovlar" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.tariffCard}>
          <Text style={styles.tariffLabel}>Joriy tarif</Text>
          <Text style={styles.tariffName}>{profileStats.tariff}</Text>
          <Text style={styles.tariffPrice}>450 000 UZS / oy</Text>
        </Card>

        <Text style={styles.sectionTitle}>Shartnoma ma'lumotlari</Text>
        <Card style={styles.contractCard}>
          <View style={styles.contractRow}>
            <Text style={styles.contractLabel}>Dars davomiyligi tarifi</Text>
            <View style={styles.durationPill}>
              <Text style={styles.durationPillText}>{courseEnrollment.tariffMinutes} daqiqalik</Text>
            </View>
          </View>
          <View style={styles.contractDivider} />
          <View style={styles.contractRow}>
            <Text style={styles.contractLabel}>Kurs boshlangan sana</Text>
            <Text style={styles.contractValue}>{formatDate(courseEnrollment.courseStartDate)}</Text>
          </View>
          <View style={styles.contractDivider} />
          <View style={styles.contractRow}>
            <Text style={styles.contractLabel}>Kurs tugash sanasi</Text>
            <Text style={styles.contractValue}>{formatDate(courseEnrollment.courseEndDate)}</Text>
          </View>
          <View style={styles.contractDivider} />
          <View style={styles.contractRow}>
            <Text style={styles.contractLabel}>Sotuv menejeri</Text>
            <Text style={styles.contractValue}>{courseEnrollment.salesManager}</Text>
          </View>
          <View style={styles.contractDivider} />
          <View style={styles.contractRow}>
            <Text style={styles.contractLabel}>Shartnoma raqami</Text>
            <Text style={styles.contractValue}>{contractNumber}</Text>
          </View>
          <View style={styles.contractDivider} />
          <Pressable style={styles.fileRow} onPress={() => Linking.openURL(getContractPdfUrl())}>
            <Ionicons name="document-text-outline" size={18} color={theme.colors.purple} />
            <Text style={styles.fileRowText}>Shartnoma faylini ko'rish (PDF)</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
          </Pressable>
        </Card>

        {debtEntry ? (
          <Card style={styles.debtBanner}>
            <View style={styles.debtBannerRow}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
              <Text style={styles.debtBannerTitle}>Qarzdorlik mavjud</Text>
            </View>
            <Text style={styles.debtBannerText}>
              {debtEntry.amount.toLocaleString('uz-UZ')} UZS — to'lov sanasi {formatDate(debtEntry.dueDate)} gacha
            </Text>
          </Card>
        ) : (
          <Card style={styles.paidBanner}>
            <View style={styles.debtBannerRow}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={styles.paidBannerTitle}>To'liq to'langan</Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>To'lov tarixi</Text>
        {paymentHistory.map((payment) => (
          <Card key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentDate}>{formatDate(payment.date)}</Text>
                <Text style={styles.paymentTariff}>{payment.tariff}</Text>
                {payment.status === 'debt' && (
                  <Text style={styles.dueDateText}>To'lov sanasi: {formatDate(payment.dueDate)}</Text>
                )}
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>{payment.amount.toLocaleString('uz-UZ')} UZS</Text>
                {payment.status === 'paid' ? (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidText}>To'langan</Text>
                  </View>
                ) : (
                  <View style={styles.debtBadge}>
                    <Text style={styles.debtText}>Qarzdor</Text>
                  </View>
                )}
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
  scroll: { padding: 20, paddingBottom: 40 },
  tariffCard: { marginBottom: 24, backgroundColor: theme.colors.purpleLight },
  tariffLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.purple },
  tariffName: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text, marginTop: 4 },
  tariffPrice: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, marginBottom: 12 },

  contractCard: { marginBottom: 20 },
  contractRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  contractLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  contractValue: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  contractDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 8 },
  durationPill: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  durationPillText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.blue },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  fileRowText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },

  debtBanner: { backgroundColor: theme.colors.dangerBg, marginBottom: 20 },
  paidBanner: { backgroundColor: theme.colors.successBg, marginBottom: 20 },
  debtBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  debtBannerTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.danger },
  paidBannerTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.success },
  debtBannerText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, marginTop: 6 },

  paymentCard: { marginBottom: 10 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentDate: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  paymentTariff: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  dueDateText: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.danger, marginTop: 4 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  paidBadge: { backgroundColor: theme.colors.successBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  paidText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.success },
  debtBadge: { backgroundColor: theme.colors.dangerBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  debtText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.danger },
});
