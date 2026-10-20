/**
 * Kompyuter: Grammatika ro'yxati (dizayn: D_GrammarList.dc.html).
 *
 * Ma'lumot mobil ekran bilan aynan bir xil: loadGrammarRows (kitob mavzulari
 * + dars bog'lanishi, "o'rganilgan"/"qisman" — dars videosi ko'rilganmi).
 * Ajratilgan qator va o'ngdagi ko'k karta — bugungi dars bilan bog'liq mavzu.
 * "Qisqacha koʻrinish" — o'sha mavzuning haqiqiy konspekti va misollari
 * (dizayndagi tuslanish jadvali va "Tipik xato" uchun maydon yo'q).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { Konspekt } from '@/components/v2/library/Konspekt';
import { loadGrammarRows, type GrammarRow } from '@/components/v2/library/grammar';
import { go, type LessonRef } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

import { DesktopPage } from '../Shell';
import { IArrow, ICheck, IChevron, Over, T } from './ui';

const EX_COLORS = ['#6A3CF0', '#087A4A'];

export function DGrammarList() {
  const [rows, setRows] = useState<GrammarRow[]>([]);
  const [related, setRelated] = useState<GrammarRow | null>(null);
  const [today, setToday] = useState<LessonRef | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadGrammarRows()
        .then((d) => {
          if (!alive) return;
          setRows(d.rows);
          setRelated(d.related);
          setToday(d.today);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const learned = rows.filter((r) => r.learned).length;
  const total = rows.length;
  const pct = total ? (learned / total) * 100 : 0;
  // Qisqacha ko'rinish: bugungi mavzu, bo'lmasa birinchi mavzu.
  const preview = related ?? rows[0] ?? null;

  return (
    <DesktopPage title="Grammatika" subtitle="Maʼlumotnoma · darslik tartibida" back={R.practice} scroll={false} contentStyle={{ paddingBottom: 32 }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 }}>
        <View accessibilityLabel="Barcha mavzular" style={s.list}>
          <View style={s.listHead}>
            <Over>Barcha mavzular</Over>
            <View style={{ flex: 1 }} />
            <View accessibilityRole="progressbar" accessibilityLabel={`${learned} / ${total} oʻrganildi`} accessibilityValue={{ min: 0, max: total, now: learned }} style={s.track}>
              <View style={[s.fill, { width: `${pct}%` }]} />
            </View>
            <T size={14} color="#075E3A">
              {learned} / {total} oʻrganildi
            </T>
          </View>
          <BarScroll>
            {rows.map((r) => {
              const on = r === related;
              return (
                <Pressable
                  key={r.topic.id}
                  accessibilityRole="link"
                  accessibilityState={{ selected: on }}
                  onPress={() => go(R.grammar(r.topic.id))}
                  style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, on ? s.rowOn : s.rowBorder, !on && hovered && { backgroundColor: '#F7F9FF' }]}
                >
                  <View style={[s.code, { backgroundColor: on ? '#FFC93C' : r.learned ? '#E3F7EE' : r.part > 0 ? '#FFF4D1' : '#EEF1F7' }]}>
                    <T size={14} color={on ? '#0B1220' : r.learned ? '#075E3A' : r.part > 0 ? '#7A5300' : '#4A5468'}>
                      {r.code}
                    </T>
                  </View>
                  <T w={700} size={15} lines={1} style={{ flex: 1, minWidth: 0 }}>
                    {r.topic.title}
                  </T>
                  <T w={700} size={13} color="#4A5468" style={{ flexShrink: 0 }}>
                    {r.where}
                  </T>
                  {r.learned ? (
                    <View accessibilityLabel="Oʻrganilgan" style={s.done}>
                      <ICheck />
                    </View>
                  ) : r.part > 0 ? (
                    <View accessibilityLabel="Qisman oʻrganilgan" style={s.part}>
                      <View style={{ width: `${Math.min(1, r.part) * 100}%`, height: '100%', backgroundColor: '#087A4A' }} />
                    </View>
                  ) : (
                    <View style={{ width: 28, flexShrink: 0 }} />
                  )}
                  {on && <IChevron />}
                </Pressable>
              );
            })}
          </BarScroll>
        </View>

        <View style={{ width: 440, flexShrink: 0, gap: 16 }}>
          {related && (
            <Pressable accessibilityRole="link" onPress={() => go(R.grammar(related.topic.id))} style={({ pressed }) => [s.hero, pressed && { opacity: 0.92 }]}>
              <View pointerEvents="none" style={s.heroCircle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.heroCode}>
                  <T size={14}>{related.code}</T>
                </View>
                <Over color="#FFFFFF">Bugungi mavzu bilan bogʻliq</Over>
              </View>
              <T f="display" size={30} lh={33} ls={-0.6} color="#FFFFFF">
                {today ? `${today.lesson.name} · ${today.number}-dars` : related.topic.title}
              </T>
              {!!related.topic.formula && <RichText text={related.topic.formula} style={s.heroFormula} />}
              <View style={s.heroBtn}>
                <T size={15} color="#1E3FD1">
                  Mavzuni ochish
                </T>
                <IArrow />
              </View>
            </Pressable>
          )}

          {preview && (
            <View accessibilityLabel={`${preview.code} koʻrinishi`} style={s.preview}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Over color="#4A5468">Qisqacha koʻrinish</Over>
                {preview.learned && (
                  <View style={s.learnedPill}>
                    <ICheck size={13} color="#075E3A" />
                    <T size={13} color="#075E3A">
                      Oʻrganilgan
                    </T>
                  </View>
                )}
              </View>
              <ScrollView style={{ flex: 1, marginHorizontal: -16 }} showsVerticalScrollIndicator={false}>
                {preview.topic.lessonId && !!preview.topic.description ? (
                  <Konspekt text={preview.topic.description} />
                ) : (
                  !!preview.topic.description && (
                    <View style={{ paddingHorizontal: 16 }}>
                      <RichText text={preview.topic.description} style={s.desc} />
                    </View>
                  )
                )}
              </ScrollView>
              {!!preview.topic.examples?.length && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {preview.topic.examples.slice(0, 2).map((ex, i) => (
                    <View key={i} style={s.ex}>
                      <T size={13} color={EX_COLORS[i]} lines={1}>
                        {ex.uz}
                      </T>
                      <T size={16} lines={1}>
                        {ex.en}
                      </T>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </DesktopPage>
  );
}

/** Ro'yxat + o'ngdagi 6px aylantirish chizig'i (dizayndagidek). */
function BarScroll({ children }: { children: ReactNode }) {
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const [y, setY] = useState(0);
  const track = Math.max(0, view - 22);
  const thumb = content > view ? Math.max(24, (view / content) * track) : 0;
  const top = content > view ? (y / (content - view)) * (track - thumb) : 0;
  return (
    <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 8 }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setView(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContent(h)}
        onScroll={(e) => setY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      <View pointerEvents="none" style={s.sbTrack}>
        {thumb > 0 && <View style={[s.sbThumb, { top, height: thumb }]} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  list: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 18, paddingRight: 12, paddingLeft: 16, gap: 10, overflow: 'hidden' },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 10, paddingLeft: 6 },
  track: { width: 140, height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#087A4A' },
  row: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 12, paddingRight: 30 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowOn: { paddingRight: 14, borderRadius: 14, backgroundColor: '#E8EEFF', boxShadow: 'inset 0 0 0 2px #2F5BFF' } as object,
  code: { width: 50, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  done: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  part: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: '#087A4A', backgroundColor: '#FFFFFF', overflow: 'hidden', flexShrink: 0 },
  sbTrack: { width: 6, borderRadius: 3, backgroundColor: '#EEF1F7', marginTop: 4, marginBottom: 18, flexShrink: 0 },
  sbThumb: { position: 'absolute', left: 0, right: 0, borderRadius: 3, backgroundColor: '#C9D1E0' },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#2F5BFF',
    borderRadius: 26,
    paddingVertical: 22,
    paddingHorizontal: 24,
    gap: 10,
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  heroCircle: { position: 'absolute', right: -40, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: '#4A70FF' },
  heroCode: { height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFC93C', justifyContent: 'center' },
  heroFormula: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 17, lineHeight: 24.65, color: '#FFFFFF' },
  heroBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preview: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 18, paddingHorizontal: 22, gap: 12, overflow: 'hidden' },
  learnedPill: { height: 28, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 5 },
  desc: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, lineHeight: 22, color: '#0B1220' },
  ex: { flex: 1, minWidth: 0, backgroundColor: '#F4F6FA', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
