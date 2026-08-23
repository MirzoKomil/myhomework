import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/CommentsSheet';
import { MaterialsList } from '@/components/ui/MaterialsList';
import { theme } from '@/constants/theme';
import { DESKTOP_CONTENT_MAX_WIDTH } from '@/constants/web';
import { useLang } from '@/i18n/LanguageContext';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials, LessonMaterials } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function SlidesScreen() {
  const { t } = useLang();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const isBonus = String(lessonId).startsWith('bonus-');
  // 151-ish: avval modul darajasida bir marta o'lchanardi (oyna kengligi
  // o'zgarsa yangilanmasdi) va desktop rejimida haqiqiy ko'rinadigan tor
  // ustundan kattaroq bo'lib, slaydlar chetga chiqib ketardi — endi reaktiv
  // va desktop kontent kengligiga cheklangan.
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, DESKTOP_CONTENT_MAX_WIDTH);
  // 53-vazifa: slaydlar 5:4 nisbatda ko'rsatilishi kerak (kengroq, ko'rishga
  // qulayroq) — slidePage'ning gorizontal padding'ini (20+20) hisobga olib,
  // balandlik shu nisbatga qarab dinamik hisoblanadi.
  const slideAreaWidth = width - 40;
  const fallbackSlideAreaHeight = (slideAreaWidth * 4) / 5;
  const [content, setContent] = useState<LessonContent | null>(null);
  const [materials, setMaterials] = useState<LessonMaterials | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [showComments, setShowComments] = useState(false);
  // 17-vazifa: rasm qat'iy 5:4 nisbatga majburlangan quti ichida "contain"
  // rejimida ko'rsatilardi — rasmning haqiqiy nisbati bundan farq qilsa,
  // pastida katta bo'sh joy (letterboxing) qolib ketardi. Endi har bir
  // rasmning o'zining haqiqiy o'lchami (Image.getSize) asosida quti
  // balandligi hisoblanadi, shu bilan bo'sh joy qolmaydi.
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 1).then(setContent);
    fetchMobileContent().then((mc) => setMaterials(getLessonMaterials(mc, String(lessonId))));
  }, [lessonId]);

  useEffect(() => {
    if (!content) return;
    content.slides.forEach((s) => {
      if (!s.imageUrl || aspectRatios[s.id]) return;
      Image.getSize(
        s.imageUrl,
        (w, h) => {
          if (w > 0 && h > 0) setAspectRatios((prev) => ({ ...prev, [s.id]: w / h }));
        },
        () => {}
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    markDone(String(lessonId), 'slidesWatch');
    saveLastPosition({ lessonId: String(lessonId), section: 'speaking/slides', label: t('hw_speaking_slides_title') });
  }, [lessonId]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.konspektSection}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const slides = content.slides;

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setActiveIndex(clamped);
  };

  const current = slides[activeIndex];
  // 17-vazifa qoshimcha: gorizontal ScrollView barcha slaydlarni bir vaqtda
  // render qilgani uchun, agar unga alohida balandlik berilmasa, u ENG
  // BALAND slayd bo'yicha o'lchamga cho'ziladi — natijada rasmi past
  // slaydlar ostida katta bo'sh joy (boshliq) qolib, pastki qism (nuqtalar,
  // Konspekt) pastda qolib ketardi. Endi konteyner balandligi FAQAT hozir
  // ko'rinib turgan slaydga qarab hisoblanadi.
  const activeRatio = current.imageUrl ? aspectRatios[current.id] : undefined;
  const activeSlideHeight = activeRatio ? slideAreaWidth / activeRatio : fallbackSlideAreaHeight;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{t('slides_title')}</Text>
        <Text style={styles.progress}>
          {activeIndex + 1} / {slides.length}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ height: activeSlideHeight }}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}>
        {slides.map((slide) => {
          const ratio = slide.imageUrl ? aspectRatios[slide.id] : undefined;
          const slideAreaHeight = ratio ? slideAreaWidth / ratio : fallbackSlideAreaHeight;
          return (
            <View key={slide.id} style={[styles.slidePage, { width }]}>
              {slide.imageUrl ? (
                <Image source={{ uri: slide.imageUrl }} style={[styles.slideImage, { height: slideAreaHeight }]} resizeMode="contain" />
              ) : (
                <View style={[styles.slideVisual, { height: slideAreaHeight }]}>
                  <Ionicons name="easel-outline" size={48} color="#fff" />
                  <Text style={styles.slideVisualTitle}>{slide.title}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.progressRow}>
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Pressable key={s.id} onPress={() => goTo(i)} hitSlop={6}>
              <View style={[styles.dotItem, i === activeIndex && styles.dotItemActive]} />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.commentsPill} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.purple} />
          <Text style={styles.commentsPillText}>{t('common_izohlar')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.konspektSection} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t('common_konspekt')}</Text>
        <Text style={styles.body}>{current.body}</Text>
        {materials && <MaterialsList files={materials.files} />}
      </ScrollView>

      <View style={styles.navRow}>
        <Pressable
          style={[styles.navBtn, activeIndex === 0 && styles.navBtnDisabled]}
          disabled={activeIndex === 0}
          onPress={() => goTo(activeIndex - 1)}>
          <Ionicons name="chevron-back" size={20} color={activeIndex === 0 ? theme.colors.textLight : theme.colors.purple} />
          <Text style={[styles.navBtnText, activeIndex === 0 && styles.navBtnTextDisabled]}>{t('common_oldingi')}</Text>
        </Pressable>
        {activeIndex === slides.length - 1 ? (
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneText}>{t('common_tugatish')}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.nextNavBtn} onPress={() => goTo(activeIndex + 1)}>
            <Text style={styles.nextNavBtnText}>{t('common_keyingi')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        category={isBonus ? 'bonus' : 'speaking'}
        itemId={String(lessonId)}
        itemLabel={content.unitTitle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  slidePage: { paddingHorizontal: 20 },
  slideVisual: {
    backgroundColor: theme.colors.pink,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  slideVisualTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },
  slideImage: { width: '100%', borderRadius: theme.radius.md, backgroundColor: theme.colors.bg },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dotItem: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.border },
  dotItemActive: { backgroundColor: theme.colors.pink, width: 20 },
  commentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
  },
  commentsPillText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple },
  konspektSection: { paddingHorizontal: 20, paddingTop: 20, flex: 1 },
  sectionLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginBottom: 6 },
  body: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.textMuted, lineHeight: 24 },
  navRow: { flexDirection: 'row', gap: 12, padding: 20 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 10 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.purple },
  navBtnTextDisabled: { color: theme.colors.textLight },
  nextNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
  },
  nextNavBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  doneBtn: { flex: 1, backgroundColor: theme.colors.success, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center' },
  doneText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
