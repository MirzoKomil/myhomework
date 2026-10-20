/**
 * Kompyuter: Slayd · to'liq ekran (dizayn: D_SlideViewer.dc.html).
 *
 * Slaydlar mobil ekrandagi kabi getResolvedLessonContent'dan, ?i= — qaysi
 * slayddan. Kompyuterda burilmaydi; kattalashtirish — brauzerning o'zi
 * (Ctrl +). Klaviatura: ← → slaydlar, Esc yopish.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { goBack } from '@/components/v2/lessons/data';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';

import { useDesktopKeys } from '../useDesktop';
import { DarkKbd, IChevron, IChevronLeft, IClose, T } from './ui';

export function DSlideViewer({ id }: { id: string }) {
  const { i } = useLocalSearchParams<{ i?: string }>();
  const { width: W, height: H } = useWindowDimensions();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [info, setInfo] = useState<{ number: number; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, Number(i) || 0));

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, isVideo: idx % 2 === 0 });
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const slides = content?.slides ?? [];
  const total = slides.length;
  const curIdx = Math.min(active, Math.max(0, total - 1));
  const cur = slides[curIdx];
  const go = (n: number) => setActive(Math.max(0, Math.min(total - 1, n)));
  // Yopilganda Slaydlar shu slayddan ochiladi.
  const close = () => goBack(`${R.slides(id)}?i=${curIdx}`);

  useDesktopKeys({ Escape: close, ArrowLeft: () => go(curIdx - 1), ArrowRight: () => go(curIdx + 1) });

  // Dizayn: 1440×900 da 1240×697 (16:9), yuqorida 76, pastda 56; yon tugmalarga joy qoladi.
  const maxW = Math.max(0, Math.min(1240, W - 200));
  const maxH = Math.max(0, H - 76 - 56 - 16);
  const imgW = Math.min(maxW, (maxH * 1240) / 697);
  const imgH = (imgW * 697) / 1240;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={close} style={({ pressed }) => [s.close, pressed && { opacity: 0.85 }]}>
          <IClose color="#FFFFFF" />
        </Pressable>
        <View style={{ gap: 1, flexShrink: 1, minWidth: 0 }}>
          <T size={16} color="#FFFFFF" lines={1}>
            {total ? `${curIdx + 1} / ${total}` : '0 / 0'}
            {cur ? ` · ${cur.title}` : ''}
          </T>
          <T f="bodyBold" size={13} color="#B8C1D6">
            {info ? `${info.number}-dars · ${info.isVideo ? 'Videodars' : 'Jonli dars'} · Slaydlar` : ''}
          </T>
        </View>
        <View style={{ flex: 1 }} />
        <Hint keys={['Ctrl', '+']} label="kattalashtirish" />
        <Hint keys={['←', '→']} label="slaydlar" gap />
        <Hint keys={['Esc']} label="yopish" gap />
      </View>

      <View style={s.stage}>
        {cur ? (
          cur.imageUrl ? (
            <Image source={{ uri: cur.imageUrl }} style={[s.img, { width: imgW, height: imgH }]} resizeMode="contain" accessibilityLabel={`${curIdx + 1}-slayd: ${cur.title}`} />
          ) : (
            <View style={[s.img, s.empty, { width: imgW, height: imgH }]}>
              <T size={34} color="#1E3FD1" style={{ textAlign: 'center' }}>
                {cur.title}
              </T>
              {!!cur.body && <RichText style={s.emptyBody} text={cur.body} />}
            </View>
          )
        ) : (
          <View style={[s.img, s.empty, { width: imgW, height: imgH }]}>
            <T f="body" size={15} color="#4A5468">
              {error ? 'Slaydlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali slayd qoʻshilmagan.' : 'Yuklanmoqda…'}
            </T>
          </View>
        )}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Oldingi slayd (←)" disabled={curIdx <= 0} onPress={() => go(curIdx - 1)} style={[s.nav, { left: 26 }, curIdx <= 0 && { opacity: 0.5 }]}>
        <IChevronLeft size={26} color="#FFFFFF" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Keyingi slayd (→)" disabled={curIdx >= total - 1} onPress={() => go(curIdx + 1)} style={[s.nav, { right: 26 }, curIdx >= total - 1 && { opacity: 0.5 }]}>
        <IChevron size={26} color="#FFFFFF" strokeWidth={2.6} />
      </Pressable>

      <View accessibilityElementsHidden style={s.dots}>
        {slides.map((x, k) => (
          <View key={x.id} style={{ width: k === curIdx ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === curIdx ? '#6D8BFF' : '#34405A' }} />
        ))}
      </View>
    </View>
  );
}

function Hint({ keys, label, gap }: { keys: string[]; label: string; gap?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: gap ? 10 : 0 }}>
      {keys.map((k) => (
        <DarkKbd key={k}>{k}</DarkKbd>
      ))}
      <T f="bodyBold" size={13} color="#B8C1D6">
        {label}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070B14', position: 'relative', overflow: 'hidden' },
  header: { height: 76, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 16 },
  close: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  stage: { position: 'absolute', left: 0, right: 0, top: 76, bottom: 56, alignItems: 'center', justifyContent: 'center' },
  img: { borderRadius: 14, backgroundColor: '#FFFFFF' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyBody: { fontFamily: fonts.body, fontSize: 18, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
  nav: { position: 'absolute', top: '50%', marginTop: -30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 18, flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
