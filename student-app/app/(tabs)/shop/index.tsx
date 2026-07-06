import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon, CoinPill } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { theme } from '@/constants/theme';
import { SHOP_CATEGORY_LABELS, SHOP_PRODUCTS, ShopCategory, ShopProduct } from '@/data/shopProducts';
import { useCoins } from '@/services/coinsStore';
import { placeOrder } from '@/services/shopStore';

const CATEGORIES: ShopCategory[] = ['merch', 'books', 'gadgets', 'stationery'];

type Dialog = { type: 'confirm'; product: ShopProduct } | { type: 'result'; success: boolean; product: ShopProduct };

export default function ShopScreen() {
  const coins = useCoins();
  const [category, setCategory] = useState<ShopCategory>('merch');
  const [showInfo, setShowInfo] = useState(false);
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const products = SHOP_PRODUCTS.filter((p) => p.category === category);

  const confirmPurchase = async () => {
    if (!dialog || dialog.type !== 'confirm') return;
    const { product } = dialog;
    const success = await placeOrder(product);
    setDialog({ type: 'result', success, product });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Homework Shop</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setShowCoinInfo(true)}>
            <CoinPill amount={coins} size={12} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/shop/orders' as never)} hitSlop={8}>
            <Ionicons name="bag-handle-outline" size={18} color={theme.colors.text} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Text style={styles.bulbEmoji}>💡</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
        {CATEGORIES.map((cat) => (
          <Pressable key={cat} style={[styles.tabChip, category === cat && styles.tabChipActive]} onPress={() => setCategory(cat)}>
            <Text style={[styles.tabChipText, category === cat && styles.tabChipTextActive]}>{SHOP_CATEGORY_LABELS[cat]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {products.map((product) => (
          <Pressable key={product.id} style={styles.card} onPress={() => setDialog({ type: 'confirm', product })}>
            <View style={[styles.cardIconWrap, { backgroundColor: product.bg }]}>
              <Ionicons name={product.icon} size={30} color={product.color} />
            </View>
            <Text style={styles.cardName} numberOfLines={2}>
              {product.name}
            </Text>
            {product.delivered && <Text style={styles.cardDelivered}>Yetkazib beriladi</Text>}
            <CoinPill amount={product.price} size={12} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={showInfo} animationType="slide" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Homework Shop qanday ishlaydi?</Text>
              <Text style={styles.sheetIntro}>
                Darslardagi mashqlar, uyga vazifalar va o'yinlarda har bir to'g'ri javob uchun 1 coin qo'lga
                kiritasiz. To'plangan coinlarni shu yerda kitoblar, gadgetlar, kontsstovarlar va Homework
                logotipli mahsulotlarga almashtirishingiz mumkin.
              </Text>
              <Text style={styles.sheetIntro}>
                Mahsulotga bosib, coin yetarli bo'lsa buyurtmani tasdiqlaysiz — u darhol "Buyurtmalar" (savatcha
                ikonkasi) bo'limiga qo'shiladi. Yetkaziladigan mahsulotlar sizga ko'rsatilgan manzil bo'yicha
                yetkazib beriladi.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dialog !== null} animationType="fade" transparent onRequestClose={() => setDialog(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setDialog(null)} />
          {dialog?.type === 'confirm' && (
            <View style={styles.dialogCard}>
              <View style={[styles.dialogIconWrap, { backgroundColor: dialog.product.bg }]}>
                <Ionicons name={dialog.product.icon} size={30} color={dialog.product.color} />
              </View>
              <Text style={styles.dialogTitle}>{dialog.product.name}</Text>
              <View style={styles.dialogPriceRow}>
                <Text style={styles.dialogPriceLabel}>Narxi:</Text>
                <CoinIcon size={16} />
                <Text style={styles.dialogPriceValue}>{dialog.product.price}</Text>
              </View>
              <Text style={styles.dialogSubtitle}>Ushbu mahsulotni sotib olishni tasdiqlaysizmi?</Text>
              <View style={styles.dialogBtnRow}>
                <Pressable style={styles.dialogCancelBtn} onPress={() => setDialog(null)}>
                  <Text style={styles.dialogCancelText}>Bekor qilish</Text>
                </Pressable>
                <Pressable style={styles.dialogConfirmBtn} onPress={confirmPurchase}>
                  <Text style={styles.dialogConfirmText}>Sotib olish</Text>
                </Pressable>
              </View>
            </View>
          )}
          {dialog?.type === 'result' && (
            <View style={styles.dialogCard}>
              <Ionicons
                name={dialog.success ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color={dialog.success ? theme.colors.success : theme.colors.danger}
              />
              <Text style={styles.dialogTitle}>{dialog.success ? 'Buyurtma qabul qilindi!' : "Yetarli coin yo'q"}</Text>
              <Text style={styles.dialogSubtitle}>
                {dialog.success
                  ? `${dialog.product.name} buyurtmalar tarixiga qo'shildi.`
                  : "Ushbu mahsulotni sotib olish uchun yetarlicha coiningiz yo'q."}
              </Text>
              <Pressable style={[styles.dialogConfirmBtn, styles.dialogConfirmBtnStandalone]} onPress={() => setDialog(null)}>
                <Text style={styles.dialogConfirmText}>Tushunarli</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulbEmoji: { fontSize: 16 },
  headerTitle: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabsRow: { flexGrow: 0, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.bg },
  tabChipActive: { backgroundColor: theme.colors.purple },
  tabChipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  tabChipTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, justifyContent: 'space-between', rowGap: 12 },
  card: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    ...theme.shadow.card,
  },
  cardIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text, textAlign: 'center' },
  cardDelivered: { fontFamily: theme.fonts.regular, fontSize: 10, color: theme.colors.textMuted, marginTop: -4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  sheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 4 },
  sheetIntro: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  dialogPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dialogPriceLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  dialogPriceValue: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#B45309' },
  dialogBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
  },
  dialogCancelText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.textMuted },
  dialogConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogConfirmBtnStandalone: { width: '100%', marginTop: 10 },
  dialogConfirmText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
