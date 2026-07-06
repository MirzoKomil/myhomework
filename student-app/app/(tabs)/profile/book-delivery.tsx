import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { BookDelivery, DELIVERY_STAGE_LABELS, DELIVERY_STAGE_ORDER, bookDeliveries } from '@/data/mock';
import { UZ_MONTHS } from '@/data/scheduleCalendar';

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d}-${UZ_MONTHS[m - 1].toLowerCase()}, ${y}`;
}

function StageTimeline({ book }: { book: BookDelivery }) {
  const currentIndex = DELIVERY_STAGE_ORDER.indexOf(book.stage);
  return (
    <View style={styles.timeline}>
      {DELIVERY_STAGE_ORDER.map((stage, i) => {
        const done = i <= currentIndex;
        const isLast = i === DELIVERY_STAGE_ORDER.length - 1;
        const dateForStage = stage === 'dispatched' ? book.dispatchedDate : stage === 'delivered' ? book.deliveredDate : undefined;
        return (
          <View key={stage} style={styles.timelineRow}>
            <View style={styles.timelineMarkerCol}>
              <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
                {done && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              {!isLast && <View style={[styles.timelineLine, i < currentIndex && styles.timelineLineDone]} />}
            </View>
            <View style={styles.timelineInfo}>
              <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{DELIVERY_STAGE_LABELS[stage]}</Text>
              {dateForStage && <Text style={styles.timelineDate}>{formatDate(dateForStage)}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BookCard({ book }: { book: BookDelivery }) {
  const delivered = book.stage === 'delivered';
  return (
    <Card style={styles.bookCard}>
      <View style={styles.bookHeadRow}>
        <View style={styles.bookIconWrap}>
          <Text style={styles.bookEmoji}>{book.emoji}</Text>
        </View>
        <View style={styles.bookHeadInfo}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.bookAddress} numberOfLines={2}>
            {book.address}
          </Text>
        </View>
      </View>

      {delivered ? (
        <View style={styles.deliveredBadge}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
          <Text style={styles.deliveredBadgeText}>Yetkazib berildi</Text>
        </View>
      ) : (
        <View style={styles.pendingBadge}>
          <Ionicons name="bicycle-outline" size={16} color="#D97706" />
          <Text style={styles.pendingBadgeText}>{DELIVERY_STAGE_LABELS[book.stage]}</Text>
        </View>
      )}

      <View style={styles.divider} />
      <StageTimeline book={book} />
    </Card>
  );
}

export default function BookDeliveryScreen() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Darslik eltib berish"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Sizga yetkazib beriladigan darsliklar holati</Text>
        {bookDeliveries.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </ScrollView>

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Ionicons name="gift-outline" size={36} color={theme.colors.purple} />
            <Text style={styles.dialogTitle}>Darslik yetkazib berish nima uchun kerak?</Text>
            <Text style={styles.dialogSubtitle}>
              Kursni sotib olganingiz uchun bonus sifatida sizga Coursebook va Vocabulary Book darsliklari bepul
              yetkazib beriladi. Qog'ozdagi kitob bilan mashq qilish darslarni yanada ko'proq va samaraliroq
              bajarishga, bilimlaringizni mustahkamlashga yordam beradi.
            </Text>
            <Pressable style={styles.dialogBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.dialogBtnText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 2 },

  bookCard: {},
  bookHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  bookIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookEmoji: { fontSize: 26 },
  bookHeadInfo: { flex: 1 },
  bookTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  bookAddress: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  deliveredBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.success },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pendingBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: '#D97706' },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },

  timeline: {},
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineMarkerCol: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.bg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  timelineLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: theme.colors.border, marginVertical: 2 },
  timelineLineDone: { backgroundColor: theme.colors.success },
  timelineInfo: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  timelineLabelDone: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
  timelineDate: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 2 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
  dialogBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
