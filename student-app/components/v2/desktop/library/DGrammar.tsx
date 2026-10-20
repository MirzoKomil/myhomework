/**
 * Kompyuter: Grammatika mavzusi (dizayn: D_Grammar.dc.html).
 *
 * Kontent mobil ekrandagi bilan aynan bir xil: kitobdan kelgan mavzu —
 * konspekt (Konspekt komponenti) va darsning slayd rasmlari; eski mavzular —
 * tushuntirish matni va misollar. Dizayndagi tuslanish jadvali o'rnida —
 * konspekt kartasi, "Qachon ishlatiladi" — haqiqiy misollar (bo'lmasa —
 * slaydlar, bosilsa to'liq ekran). "Tipik xato" uchun ma'lumot yo'q — ko'rsatilmaydi.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { Konspekt } from '@/components/v2/library/Konspekt';
import { loadGrammarRows, type GrammarRow } from '@/components/v2/library/grammar';
import { go } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { resolveMediaUrl } from '@/services/contentApi';

import { DesktopPage } from '../Shell';
import { ICheck, IPlay, T } from './ui';

const EX_COLORS = ['#6A3CF0', '#087A4A', '#B34700', '#B42318'];

export function DGrammar() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [row, setRow] = useState<GrammarRow | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadGrammarRows()
        .then((d) => {
          if (!alive) return;
          setRow(d.rows.find((r) => r.topic.id === topicId) ?? null);
          setTotal(d.rows.length);
        })
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, [topicId]),
  );

  if (!row) {
    return (
      <DesktopPage title="Grammatika" back={R.grammarList}>
        {loaded && (
          <T w={700} size={15} color="#4A5468">
            Mavzu topilmadi
          </T>
        )}
      </DesktopPage>
    );
  }

  const { topic, lesson, learned, code } = row;
  const isBook = !!topic.lessonId;
  const examples = topic.examples ?? [];
  const images = lesson ? topic.images ?? [] : [];

  return (
    <DesktopPage
      title={topic.title}
      subtitle={`Maʼlumotnoma · ${code} / ${total}${lesson ? ` · ${lesson.number}-dars` : ''}`}
      back={R.grammarList}
      actions={
        learned ? (
          <View style={s.learned}>
            <ICheck size={16} color="#075E3A" />
            <T size={15} color="#075E3A">
              Oʻrganilgan
            </T>
          </View>
        ) : null
      }
      scroll={false}
      contentStyle={{ paddingBottom: 32 }}
    >
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
          <View style={s.hero}>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              {lesson && (
                <View style={s.lessonPill}>
                  <T size={14}>{lesson.number}-dars</T>
                </View>
              )}
              <T f="display" size={34} lh={35.7} ls={-0.68} color="#FFFFFF" accessibilityRole="header">
                {topic.title}
              </T>
              {!!topic.formula && <RichText text={topic.formula} style={s.formula} />}
            </View>
            <View style={s.heroImg}>
              <Image source={designImages['f639c30e1400761df83230b833ba42b2']} style={{ width: 116, height: 116 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            </View>
          </View>

          <View style={s.body}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {isBook && !!topic.description ? (
                <View style={{ marginHorizontal: -16 }}>
                  <Konspekt text={topic.description} />
                </View>
              ) : topic.description ? (
                <RichText text={topic.description} style={s.desc} />
              ) : (
                <T w={600} size={15} color="#4A5468" style={{ paddingTop: 6 }}>
                  Bu mavzu tez orada toʻldiriladi
                </T>
              )}
            </ScrollView>
          </View>
        </View>

        <View style={{ width: 420, flexShrink: 0, gap: 16 }}>
          {examples.length > 0 ? (
            <>
              <T size={19} accessibilityRole="header">
                Qachon ishlatiladi
              </T>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, gap: 12 }} showsVerticalScrollIndicator={false}>
                {examples.map((ex, i) => (
                  <View key={i} style={[s.ex, { boxShadow: `inset 5px 0 0 ${EX_COLORS[i % EX_COLORS.length]}` } as object, examples.length <= 4 && { flex: 1 }]}>
                    <RichText text={ex.en} style={s.exRu} />
                    {!!ex.uz && (
                      <T w={600} size={14} color="#4A5468">
                        {ex.uz}
                      </T>
                    )}
                  </View>
                ))}
              </ScrollView>
            </>
          ) : images.length > 0 && lesson ? (
            <>
              <T size={19} accessibilityRole="header">
                Slaydlar
              </T>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
                {images.map((uri, i) => (
                  <Pressable
                    key={uri}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`${i + 1}-slayd, kattalashtirish`}
                    onPress={() => go(`${R.slideViewer(lesson.lesson.id)}?i=${i}`)}
                    style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.slide, hovered && { opacity: 0.92 }]}
                  >
                    <Image source={{ uri: resolveMediaUrl(uri) ?? uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {lesson && (
            <Pressable accessibilityRole="link" onPress={() => go(R.lesson(lesson.lesson.id))} style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
              <IPlay size={18} />
              <T size={17} color="#FFFFFF">
                Darsga oʻtish · {lesson.number}-dars
              </T>
            </Pressable>
          )}
        </View>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  learned: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 7, marginRight: 6 },
  hero: { position: 'relative', overflow: 'hidden', backgroundColor: '#2F5BFF', borderRadius: 26, paddingTop: 16, paddingRight: 22, paddingBottom: 16, paddingLeft: 26, flexDirection: 'row', alignItems: 'center', gap: 20 },
  lessonPill: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFC93C', justifyContent: 'center' },
  formula: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  heroImg: { width: 112, height: 112, borderRadius: 24, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 16, paddingHorizontal: 26, paddingBottom: 8 },
  desc: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 17, lineHeight: 25, color: '#0B1220' },
  ex: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 22, justifyContent: 'center', gap: 4 },
  exRu: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 23, lineHeight: 31, color: '#0B1220' },
  slide: { width: '100%', aspectRatio: 16 / 9, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E8EEFF' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
});
