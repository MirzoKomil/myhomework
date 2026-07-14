import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { BookDelivery, DELIVERY_STAGE_LABELS, DELIVERY_STAGE_ORDER, DeliveryStage, bookDeliveries } from '@/data/mock';
import { UZ_MONTHS } from '@/data/scheduleCalendar';
import { DemoBookDeliveryResponse, fetchDemoBookDelivery } from '@/services/contentApi';
import { useOrders } from '@/services/shopStore';

type Category = 'books' | 'shop';

const CATEGORY_LABELS: Record<Category, string> = {
  books: 'Kitob yetkazish',
  shop: 'Homework Shop',
};

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d}-${UZ_MONTHS[m - 1].toLowerCase()}, ${y}`;
}

function StageTimeline({
  stage,
  dispatchedDate,
  deliveredDate,
}: {
  stage: DeliveryStage;
  dispatchedDate?: string;
  deliveredDate?: string;
}) {
  const currentIndex = DELIVERY_STAGE_ORDER.indexOf(stage);
  return (
    <View style={styles.timeline}>
      {DELIVERY_STAGE_ORDER.map((s, i) => {
        const done = i <= currentIndex;
        const isLast = i === DELIVERY_STAGE_ORDER.length - 1;
        const dateForStage = s === 'dispatched' ? dispatchedDate : s === 'delivered' ? deliveredDate : undefined;
        return (
          <View key={s} style={styles.timelineRow}>
            <View style={styles.timelineMarkerCol}>
              <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
                {done && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              {!isLast && <View style={[styles.timelineLine, i < currentIndex && styles.timelineLineDone]} />}
            </View>
            <View style={styles.timelineInfo}>
              <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{DELIVERY_STAGE_LABELS[s]}</Text>
              {dateForStage && <Text style={styles.timelineDate}>{formatDate(dateForStage)}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StatusBadge({ stage }: { stage: DeliveryStage }) {
  const delivered = stage === 'delivered';
  return delivered ? (
    <View style={styles.deliveredBadge}>
      <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
      <Text style={styles.deliveredBadgeText}>Yetkazib berildi</Text>
    </View>
  ) : (
    <View style={styles.pendingBadge}>
      <Ionicons name="bicycle-outline" size={16} color="#D97706" />
      <Text style={styles.pendingBadgeText}>{DELIVERY_STAGE_LABELS[stage]}</Text>
    </View>
  );
}

function BookCard({ book }: { book: BookDelivery }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeadRow}>
        <View style={styles.itemIconWrap}>
          <Text style={styles.itemEmoji}>{book.emoji}</Text>
        </View>
        <View style={styles.itemHeadInfo}>
          <Text style={styles.itemTitle}>{book.title}</Text>
          <Text style={styles.itemAddress} numberOfLines={2}>
            {book.address}
          </Text>
        </View>
      </View>
      <StatusBadge stage={book.stage} />
      <View style={styles.divider} />
      <StageTimeline stage={book.stage} dispatchedDate={book.dispatchedDate} deliveredDate={book.deliveredDate} />
    </Card>
  );
}

function ShopOrderCard({ order }: { order: ReturnType<typeof useOrders>[number] }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeadRow}>
        <View style={styles.itemIconWrap}>
          <Ionicons name="bag-handle" size={24} color={theme.colors.purple} />
        </View>
        <View style={styles.itemHeadInfo}>
          <Text style={styles.itemTitle}>{order.productName}</Text>
          <View style={styles.orderPriceRow}>
            <CoinIcon size={12} />
            <Text style={styles.orderPriceText}>{order.price} — {order.date} sotib olindi</Text>
          </View>
        </View>
      </View>
      <StatusBadge stage={order.stage} />
      <View style={styles.divider} />
      <StageTimeline stage={order.stage} dispatchedDate={order.dispatchedAt ?? undefined} deliveredDate={order.deliveredAt ?? undefined} />
    </Card>
  );
}

export default function BookDeliveryScreen() {
  const [showInfo, setShowInfo] = useState(false);
  const [category, setCategory] = useState<Category>('books');
  const orders = useOrders();

  // CRM'ning Sotuv bo'limidagi "Kitob yetkazish" kanban-yozuvidan haqiqiy
  // holat — namuna o'quvchiga mos yozuv topilmasa, statik namuna holatida qoladi.
  const [realDelivery, setRealDelivery] = useState<DemoBookDeliveryResponse>(null);
  useEffect(() => {
    fetchDemoBookDelivery()
      .then(setRealDelivery)
      .catch(() => {});
  }, []);

  const displayedBooks: BookDelivery[] = useMemo(() => {
    if (!realDelivery) return bookDeliveries;
    return bookDeliveries.map((b) => ({
      ...b,
      address: realDelivery.address || b.address,
      stage: realDelivery.stage,
      dispatchedDate: realDelivery.dispatchedDate ?? undefined,
      deliveredDate: realDelivery.deliveredDate ?? undefined,
    }));
  }, [realDelivery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Yetkazib berish xizmati"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />

      <View style={styles.categoryRow}>
        {(['books', 'shop'] as Category[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.categoryChip, category === c && styles.categoryChipActive]}
            onPress={() => setCategory(c)}>
            <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>
              {CATEGORY_LABELS[c]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {category === 'books' ? (
          <>
            <Text style={styles.subtitle}>Sizga yetkazib beriladigan darsliklar holati</Text>
            {displayedBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Homework Shop'dan sotib olgan tovarlaringiz yetkazib berish jarayoni</Text>
            {orders.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bag-handle-outline" size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>Hali xaridlar yo'q</Text>
              </View>
            ) : (
              orders.map((order) => <ShopOrderCard key={order.id} order={order} />)
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Ionicons name="gift-outline" size={36} color={theme.colors.purple} />
            <Text style={styles.dialogTitle}>Yetkazib berish xizmati nima uchun kerak?</Text>
            <Text style={styles.dialogSubtitle}>
              Kursni sotib olganingiz uchun bonus sifatida sizga Coursebook va Vocabulary Book darsliklari bepul
              yetkazib beriladi. Bundan tashqari, Homework Shop'dan coinlaringizga sotib olgan tovarlaringiz ham
              shu yerda kuzatib borilishi mumkin.
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
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
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

  categoryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  categoryChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  categoryChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  categoryChipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  categoryChipTextActive: { color: '#fff' },

  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },

  itemCard: {},
  itemHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  itemIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 26 },
  itemHeadInfo: { flex: 1 },
  itemTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  itemAddress: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  orderPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  orderPriceText: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },

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
