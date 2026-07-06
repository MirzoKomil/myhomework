import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ReactNode, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Share, ScrollView, StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const REFERRAL_CODE = 'SHAHZODA24';
const REFERRAL_LINK = `https://myhomework.uz/ref/${REFERRAL_CODE}`;
const FRIEND_COUNT = 0;

const CARD_WIDTH = Math.min(Dimensions.get('window').width, 520) - 40;

type Slide = { badge?: string; title: string; subtitle?: string; render: () => ReactNode };

function LinkIllustration() {
  const names = ['M. Murodjon', 'S. Said', 'L. Muhammad'];
  return (
    <View style={illustrationStyles.linkWrap}>
      <View style={illustrationStyles.linkCircle}>
        <Ionicons name="link" size={22} color="#fff" />
      </View>
      <View style={illustrationStyles.namesCol}>
        {names.map((n) => (
          <View key={n} style={illustrationStyles.namePill}>
            <View style={illustrationStyles.nameAvatar}>
              <Ionicons name="person" size={14} color={theme.colors.purple} />
            </View>
            <Text style={illustrationStyles.nameText}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DiscountIllustration() {
  return (
    <View style={illustrationStyles.discountWrap}>
      <View style={illustrationStyles.discountCard}>
        <Ionicons name="pricetag" size={18} color={theme.colors.purple} style={{ marginBottom: 4 }} />
        <Text style={illustrationStyles.discountLabel}>Chegirma</Text>
        <Text style={illustrationStyles.discountValue}>10%</Text>
      </View>
    </View>
  );
}

function CoinBonusIllustration() {
  return (
    <View style={illustrationStyles.coinWrap}>
      <CoinIcon size={40} />
      <Text style={illustrationStyles.coinPlus}>+100</Text>
    </View>
  );
}

function FaqSlideContent() {
  const faqs = [
    { q: 'Kimni taklif qilsam bo\'ladi?', a: "Faqat yangi foydalanuvchilar (ilgari ro'yxatdan o'tmagan)." },
    { q: 'Havola ishlamayapti?', a: "Havolani qayta jo'nating yoki ilovani yangilab qayta urinib ko'ring." },
  ];
  return (
    <View style={{ gap: 10 }}>
      {faqs.map((f) => (
        <View key={f.q} style={illustrationStyles.faqBox}>
          <Text style={illustrationStyles.faqQ}>{f.q}</Text>
          <Text style={illustrationStyles.faqA}>{f.a}</Text>
        </View>
      ))}
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    badge: '1-qadam',
    title: 'Referral havolangizni ulashing',
    subtitle: "Havolangizni ingliz tilini o'rganmoqchi bo'lgan do'stlaringizga yuboring.",
    render: () => <LinkIllustration />,
  },
  {
    badge: '2-qadam',
    title: 'Ular 10% chegirma olishadi',
    subtitle: "Sizning havolangiz orqali ro'yxatdan o'tgan do'stingiz 10% chegirma oladi.",
    render: () => <DiscountIllustration />,
  },
  {
    badge: '3-qadam',
    title: "Siz qo'shimcha 100 coin olasiz",
    subtitle:
      "Do'stingiz ilovani yuklab olgani uchun sizga coin beramiz, shuningdek, agarda u o'sha kunning o'zida kurs sotib olsa siz yana qo'shimcha coinga ega bo'lasiz.",
    render: () => <CoinBonusIllustration />,
  },
  {
    title: 'Savollaringiz bormi?',
    render: () => <FaqSlideContent />,
  },
];

export default function MotivationScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 14));
    setActiveIndex(idx);
  };

  const handleShare = async () => {
    const message = `Myhomework.uz orqali ingliz tilini o'rganing! Mening havolam: ${REFERRAL_LINK}`;
    try {
      await Share.share({ message, url: REFERRAL_LINK });
    } catch {
      await Clipboard.setStringAsync(REFERRAL_LINK);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Referal havola" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 14}>
          {SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slideCard, { width: CARD_WIDTH }]}>
              {slide.badge && (
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{slide.badge}</Text>
                </View>
              )}
              <Text style={styles.slideTitle}>{slide.title}</Text>
              {slide.subtitle && <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>}
              <View style={styles.slideIllustration}>{slide.render()}</View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.friendsCard}>
          <Text style={styles.friendsLabel}>Do'stlar</Text>
          <View style={styles.friendsValueWrap}>
            <Text style={styles.friendsValue}>{FRIEND_COUNT}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>{copied ? 'Havola nusxalandi!' : 'Havolani ulashish'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingTop: 16, paddingBottom: 16 },

  carouselContent: { paddingHorizontal: 20, gap: 14 },
  slideCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 22,
    ...theme.shadow.card,
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.blueLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgePillText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.blue },
  slideTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 8 },
  slideSubtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 18 },
  slideIllustration: {
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.md,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.border },
  dotActive: { backgroundColor: theme.colors.purple, width: 20 },

  friendsCard: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsLabel: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.purpleDark },
  friendsValueWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...theme.shadow.card,
  },
  friendsValue: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text },

  bottomBar: { padding: 20, paddingTop: 8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    ...theme.shadow.card,
  },
  shareBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});

const illustrationStyles = StyleSheet.create({
  linkWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' },
  linkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  namesCol: { flex: 1, gap: 8 },
  namePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...theme.shadow.card,
  },
  nameAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.text },

  discountWrap: { alignItems: 'center', justifyContent: 'center' },
  discountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.purple,
    paddingHorizontal: 28,
    paddingVertical: 18,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  discountLabel: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textMuted },
  discountValue: { fontFamily: theme.fonts.extraBold, fontSize: 32, color: theme.colors.purple, marginTop: 2 },

  coinWrap: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  coinPlus: { fontFamily: theme.fonts.extraBold, fontSize: 40, color: theme.colors.purpleDark },

  faqBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    width: '100%',
    ...theme.shadow.card,
  },
  faqQ: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text, marginBottom: 4 },
  faqA: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
});
