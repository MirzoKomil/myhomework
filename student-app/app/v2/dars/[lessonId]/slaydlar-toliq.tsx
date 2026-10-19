/**
 * v2 Slayd · to'liq ekran (dizayn: 84 · SlideViewer, landscape).
 *
 * Slaydlar Slides ekranidagi kabi getResolvedLessonContent'dan. Dizayndagidek
 * telefon tik turganda ko'rinish 90° burilgan gorizontal qatlamda chiziladi
 * (tepa qismi ekranning o'ng chetida); ekran o'zi gorizontal bo'lsa
 * (planshet/kompyuter) — burilmasdan. ?i=<raqam> — qaysi slayddan boshlash.
 * Kattalashtirish — iOS'da ScrollView zoom, vebda brauzerning o'z pinch'i.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RichText } from '@/components/RichText';
import { goBack } from '@/components/v2/lessons/data';
import { BackIcon, ChevronRight, CloseIcon, PinchIcon } from '@/components/v2/lessons/icons';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';

export default function SlideViewerScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { lessonId, i } = useLocalSearchParams<{ lessonId: string; i?: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, Number(i) || 0));

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (!cancelled) setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const slides = content?.slides ?? [];
  const total = slides.length;
  const cur = slides[Math.min(active, Math.max(0, total - 1))];
  const go = (n: number) => setActive(Math.max(0, Math.min(total - 1, n)));

  // Tik ekranda — qatlam 90° buriladi (dizayn: translate(390px,0) rotate(90deg), origin 0 0).
  const rotate = H > W;
  const LW = rotate ? H : W; // qatlam eni
  const LH = rotate ? W : H; // qatlam bo'yi
  // Dizayndagi o'lchovlar: 844×390 qatlamda tepa/past 6, yon 16, sarlavha 44, tugmalar 52, oraliq 12.
  const padSide = 16 + (rotate ? 0 : Math.max(insets.left, insets.right));
  const padTop = 6 + (rotate ? insets.right : insets.top);
  const padBottom = 6 + (rotate ? insets.left : insets.bottom);
  const maxH = Math.max(0, LH - padTop - padBottom - 44);
  const maxW = Math.max(0, LW - padSide * 2 - 52 * 2 - 12 * 2);
  const imgW = Math.min(maxW, (maxH * 594) / 334);
  const imgH = (imgW * 334) / 594;

  const layer = (
    <View
      style={[
        styles.layer,
        { width: LW, height: LH, paddingLeft: padSide, paddingRight: padSide, paddingTop: padTop, paddingBottom: padBottom },
        rotate && ({ transform: [{ translateX: W }, { rotate: '90deg' }], transformOrigin: '0 0' } as object),
      ]}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => goBack(R.slides(id))} style={({ pressed }) => [styles.close, pressed && { opacity: 0.85 }]}>
          <CloseIcon color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          <Text style={{ fontVariant: ['tabular-nums'] }}>{total ? `${Math.min(active, total - 1) + 1} / ${total}` : '0 / 0'}</Text>
          {!!cur && <Text style={{ color: '#AEB6C8' }}> · </Text>}
          {cur?.title ?? ''}
        </Text>
        <View style={styles.pinch}>
          <PinchIcon />
          <Text style={styles.pinchText}>Pinch bilan kattalashtiring</Text>
        </View>
      </View>
      <View style={styles.stage}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Oldingi slayd"
          disabled={active <= 0}
          onPress={() => go(active - 1)}
          style={[styles.nav, { backgroundColor: 'rgba(255,255,255,0.14)' }, active <= 0 && { opacity: 0.5 }]}
        >
          <BackIcon size={22} color="#FFFFFF" />
        </Pressable>
        {cur ? (
          <ScrollView
            style={{ width: imgW, height: imgH, flexGrow: 0 }}
            contentContainerStyle={{ width: imgW, height: imgH }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {cur.imageUrl ? (
              <Image source={{ uri: cur.imageUrl }} style={[styles.img, { width: imgW, height: imgH }]} resizeMode="contain" accessibilityLabel={`${active + 1}-slayd: ${cur.title}`} />
            ) : (
              <View style={[styles.img, styles.empty, { width: imgW, height: imgH }]}>
                <Text style={styles.emptyTitle}>{cur.title}</Text>
                {!!cur.body && <RichText style={styles.emptyBody} text={cur.body} />}
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={[styles.img, styles.empty, { width: imgW, height: imgH }]}>
            <Text style={styles.emptyBody}>{error ? 'Slaydlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali slayd qoʻshilmagan.' : 'Yuklanmoqda…'}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keyingi slayd"
          disabled={active >= total - 1}
          onPress={() => go(active + 1)}
          style={[styles.nav, { backgroundColor: '#2F5BFF' }, active >= total - 1 && { opacity: 0.5 }]}
        >
          <ChevronRight size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  return <View style={styles.screen}>{layer}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220', overflow: 'hidden', position: 'relative' },
  layer: { position: 'absolute', left: 0, top: 0 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', fontWeight: 'normal' },
  pinch: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  pinchText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#DCE2EE', fontWeight: 'normal' },
  stage: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nav: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  img: { borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' } as object,
  empty: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontFamily: fonts.bodyHeavy, fontSize: 22, color: '#1E3FD1', textAlign: 'center', fontWeight: 'normal' },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
});
