/**
 * v2 Uyga vazifa (dizayn: 13 · Homework).
 *
 * Ma'lumot eski homework/index.tsx bilan bir xil manbadan: dars kontenti
 * (fetchMobileContent → homeworkParts), bajarilgan qismlar
 * (lessonProgressStore), ustoz tekshiradigan qismlar holati
 * (creativeSubmissionApi). Savollar soni/coin — scoreStore (qurilmada).
 * Vazifa muddati serverda yo'q — "—" ko'rsatiladi.
 */
import { Confetti } from '@/components/v2/motion';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { v2Back } from '@/services/v2Nav';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, ChevronRight, Coin, LockSmall } from '@/components/v2/homework/icons';
import { isTeacherGraded, KIND_SHORT, KIND_SUB, KIND_TILE, lessonLabel, loadLessonInfo, partLetter, partQuestionCount, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { Txt, webShadow } from '@/components/v2/homework/ui';
import { HomeworkSentPopup } from '@/components/v2/popups/HomeworkSent';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';
import { fetchCreativeSubmission, submissionKey, type CreativeSubmissionRecord } from '@/services/creativeSubmissionApi';
import { useLessonProgress } from '@/services/lessonProgressStore';

export default function HomeworkScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId, yuborildi, bajarildi } = useLocalSearchParams<{
    lessonId: string;
    yuborildi?: string;
    /** Bitta qism hozirgina topshirildi — kichik konfetti. */
    bajarildi?: string;
  }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const [reading, setReading] = useState<CreativeSubmissionRecord | null>(null);
  const [creative, setCreative] = useState<CreativeSubmissionRecord | null>(null);
  const [sentOpen, setSentOpen] = useState(yuborildi === '1');
  const progress = useLessonProgress(id);
  const scores = useHomeworkScores();

  useEffect(() => {
    let cancelled = false;
    loadLessonInfo(id)
      .then((r) => !cancelled && setInfo(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Ustoz tekshiradigan qismlar holati ekranga qaytilganda ham yangilansin.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchCreativeSubmission(id).then((r) => !cancelled && setCreative(r));
      fetchCreativeSubmission(submissionKey(id, 'reading')).then((r) => !cancelled && setReading(r));
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (!info) {
    return (
      <View style={[st.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        {error ? (
          <Txt f="bodyBold" size={15} color="#4A5468">
            Vazifani yuklab boʻlmadi
          </Txt>
        ) : (
          <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
        )}
      </View>
    );
  }

  const parts = info.content.homeworkParts;
  const lessonScores = scores[id] ?? {};
  const isDone = (p: HomeworkPart) =>
    p.kind === 'creative' ? creative?.status === 'graded' : p.kind === 'reading' ? reading?.status === 'graded' : !!progress.homeworkParts[p.id] || !!lessonScores[p.id]?.finished;
  const isPending = (p: HomeworkPart) => (p.kind === 'creative' && creative?.status === 'pending') || (p.kind === 'reading' && reading?.status === 'pending');

  // Avtomatik tekshiriladigan qismlar — "x / y savol bajarildi" va coin shulardan.
  const autoParts = parts.filter((p) => !isTeacherGraded(p));
  const answeredOf = (p: HomeworkPart) => {
    const sc = lessonScores[p.id];
    const total = partQuestionCount(p);
    if (isDone(p)) return total;
    return Math.min(total, sc?.answered ?? 0);
  };
  const totalQ = autoParts.reduce((a, p) => a + partQuestionCount(p), 0);
  const answeredQ = autoParts.reduce((a, p) => a + answeredOf(p), 0);
  const earned = autoParts.reduce((a, p) => a + (lessonScores[p.id]?.coins ?? 0), 0);
  const correctQ = autoParts.reduce((a, p) => a + Math.min(partQuestionCount(p), lessonScores[p.id]?.correct ?? 0), 0);
  const allAutoDone = autoParts.length > 0 && autoParts.every(isDone);

  // Birinchi bajarilmagan qism — "davom ettirish" tugmasi va ko'k ramka shu qismda.
  const current = parts.find((p) => !isDone(p) && !isPending(p));
  const openPart = (p: HomeworkPart) => router.push(R.homeworkPart(id, p.id) as Href);

  // Oldingi dars vazifasi — takrorlash qatori.
  const prev = info.prev && info.prev.content.homeworkParts.length > 0 ? info.prev : null;
  const prevScores = prev ? (scores[prev.id] ?? {}) : {};
  const prevAuto = prev ? prev.content.homeworkParts.filter((p) => !isTeacherGraded(p)) : [];
  const prevTotal = prevAuto.reduce((a, p) => a + partQuestionCount(p), 0);
  const prevCorrect = prevAuto.reduce((a, p) => a + (prevScores[p.id]?.correct ?? 0), 0);

  // "Yodda tuting": shu darsning bo'sh joy savollaridan ikkitasi (avval xato qilinganlari),
  // to'g'ri shakli ajratilgan va ishlatilmaydigan variantlar bilan.
  const remember = parts
    .flatMap((p) =>
      p.kind === 'fillBlank'
        ? p.blanks.map((b) => ({
            b,
            wrong: (lessonScores[p.id]?.mistakes ?? []).includes(b.sentence),
          }))
        : [],
    )
    .sort((x, y) => Number(y.wrong) - Number(x.wrong))
    .slice(0, 2)
    .map(({ b }) => b);

  const continueLabel = current
    ? `${partLetter(current) ? `${partLetter(current)} qismni` : `«${current.title}»ni`} ${lessonScores[current.id]?.answered ? 'davom ettirish' : 'boshlash'}`
    : 'Natijani koʻrish';

  return (
    <View style={st.screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[st.column, { paddingTop: Math.max(insets.top, 44) + 10, flexGrow: 1 }]}>
          <View style={st.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Orqaga"
              onPress={() => v2Back(R.lesson(id))}
              style={({ pressed }) => [st.back, pressed && st.pressed]}
            >
              <BackIcon />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Txt f="display" size={24} lh={26.4} style={{ letterSpacing: -0.48 }} accessibilityRole="header">
                Uyga vazifa
              </Txt>
              <Txt f="bodyBold" size={13} color="#4A5468" numberOfLines={1}>
                {lessonLabel(info.number, info.name)}
              </Txt>
            </View>
          </View>

          <View style={st.body}>
            <View style={st.deadline}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt f="bodyBold" size={13} color="#B8C1D6">
                    Muddat
                  </Txt>
                  <Txt f="display" size={22} color="#FFFFFF">
                    —
                  </Txt>
                </View>
                <View style={st.coinPill}>
                  <Coin size={18} />
                  <Txt f="bodyHeavy" size={15} color="#FFE08A">
                    {earned} / {totalQ}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }} accessible={false}>
                {(autoParts.length ? autoParts : [null]).map((p, i) => {
                  const pct = p ? (answeredOf(p) / Math.max(1, partQuestionCount(p))) * 100 : 0;
                  return (
                    <View key={p?.id ?? i} style={st.seg}>
                      <View
                        style={{
                          width: `${pct}%`,
                          height: 6,
                          backgroundColor: '#FFC93C',
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              <Txt f="body" size={13} color="#B8C1D6">
                {answeredQ} / {totalQ} savol javob berildi · {correctQ} ta toʻgʻri = {earned} coin
              </Txt>
            </View>

            {parts.length === 0 && (
              <View style={st.infoCard}>
                <Txt f="body" size={13} color="#4A5468" lh={18.2}>
                  Bu dars uchun vazifa hali kiritilmagan.
                </Txt>
              </View>
            )}

            {parts.map((p) => {
              const focused = current?.id === p.id;
              const tile = KIND_TILE[p.kind];
              const total = partQuestionCount(p);
              const answered = answeredOf(p);
              const done = isDone(p);
              const pending = isPending(p);
              const started = answered > 0 && !done;
              const letter = partLetter(p);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => openPart(p)}
                  style={({ pressed }) => [
                    st.partCard,
                    focused && Platform.OS !== 'web' && st.partFocused,
                    focused && webShadow('0 0 0 2px #2F5BFF, 0 8px 22px rgba(47,91,255,0.14)'),
                    pressed && st.pressed,
                  ]}
                >
                  <View style={[st.tile, { backgroundColor: tile.bg }]}>
                    <Txt f="display" size={20} color={tile.fg}>
                      {letter ?? KIND_SHORT[p.kind].slice(0, 1)}
                    </Txt>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Txt f="bodyHeavy" size={16}>
                      {p.title}
                    </Txt>
                    <Txt f="body" size={13} color="#4A5468">
                      {isTeacherGraded(p) ? KIND_SUB[p.kind] : `${total} savol · ${KIND_SUB[p.kind]}`}
                    </Txt>
                    {started ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 3,
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#E7EBF3',
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              width: `${(answered / Math.max(1, total)) * 100}%`,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: tile.bar,
                            }}
                          />
                        </View>
                        <Txt f="bodyHeavy" size={12} color={tile.fg} numberOfLines={1}>
                          {answered} / {total}
                          {/* Boshlangan, lekin hozirgi (ko'k ramkali) bo'lmagan qism. */}
                          {focused ? '' : ' · davom etmoqda'}
                        </Txt>
                      </View>
                    ) : (
                      <Txt f="bodyHeavy" size={12} color={done ? '#075E3A' : '#4A5468'}>
                        {done ? 'Bajarildi' : pending ? 'Yuborilgan — tekshirilmoqda' : 'Boshlanmagan'}
                      </Txt>
                    )}
                  </View>
                  <ChevronRight />
                </Pressable>
              );
            })}

            <View style={st.autoCard}>
              <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 40, height: 40, flexShrink: 0 }} />
              <Txt f="body" size={13} color="#4A5468" lh={17.55} style={{ flex: 1 }}>
                <Txt f="bodyHeavy" size={13}>
                  Avtomatik tekshiriladi
                </Txt>
                {` · ${totalQ}/${totalQ} boʻlgach topshirasiz, natija va coin darhol chiqadi.`}
              </Txt>
            </View>

            {remember.length > 0 && (
              <View accessibilityLabel="Yodda tuting" style={st.remember}>
                <Txt
                  f="bodyHeavy"
                  size={12}
                  color="#4A5468"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.72,
                    paddingBottom: 4,
                  }}
                >
                  Yodda tuting
                </Txt>
                {remember.map((b) => {
                  const [before, ...rest] = b.sentence.split(/_{2,}/);
                  const others = b.options.filter((o) => o !== b.answer);
                  return (
                    <View key={b.id} style={st.rememberRow}>
                      <Txt f="bodyHeavy" size={15} lang="ru" style={{ flex: 1 }}>
                        {before}
                        <Txt f="bodyHeavy" size={15} color="#1E3FD1">
                          {b.answer}
                        </Txt>
                        {rest.join(b.answer)}
                      </Txt>
                      {others.length > 0 && (
                        <Txt f="body" size={13} color="#4A5468" style={{ flexShrink: 0, maxWidth: '45%' }}>
                          (
                          <Txt f="body" size={13} color="#4A5468" lang="ru">
                            {others.join(', ')}
                          </Txt>{' '}
                          emas)
                        </Txt>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {prev && (
              <View style={st.repeat}>
                <Txt f="bodyBold" size={13} color="#075E3A">
                  <Txt f="bodyHeavy" size={13} color="#075E3A">
                    {prev.number}-dars vazifasi
                  </Txt>
                  {` · ${prevCorrect}/${prevTotal} toʻgʻri · takrorlash`}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {prev.content.homeworkParts.slice(0, 3).map((p) => {
                    const l = partLetter(p);
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        onPress={() => router.push(R.homeworkPart(prev.id, p.id) as Href)}
                        style={({ pressed }) => [st.repeatBtn, pressed && st.pressed]}
                      >
                        <Txt f="bodyHeavy" size={13} color="#075E3A" numberOfLines={1}>
                          {l ? `${l} · ${KIND_SHORT[p.kind]}` : KIND_SHORT[p.kind]}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Pastki tugmalar dizayndagidek doim ko'rinadi (ro'yxat ustida aylanmaydi). */}
      <View style={st.column}>
        <View style={[st.footer, { paddingBottom: Math.max(28, insets.bottom + 14) }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (current ? openPart(current) : allAutoDone ? setSentOpen(true) : undefined)}
            style={({ pressed }) => [st.cta, webShadow('0 5px 0 #1E3FD1'), pressed && st.pressed]}
          >
            <Txt f="bodyHeavy" size={16} color="#FFFFFF" numberOfLines={1}>
              {continueLabel}
            </Txt>
          </Pressable>
          {/* Barcha avtomatik savollar javoblanmaguncha "Topshirish" qulflangan. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !allAutoDone }}
            disabled={!allAutoDone}
            onPress={() => setSentOpen(true)}
            style={({ pressed }) => [st.submit, allAutoDone && { backgroundColor: '#E3F7EE' }, pressed && st.pressed]}
          >
            {!allAutoDone && <LockSmall />}
            <Txt f="bodyHeavy" size={14} color={allAutoDone ? '#075E3A' : '#4A5468'}>
              {allAutoDone ? 'Topshirish' : `Topshirish · ${Math.max(0, totalQ - answeredQ)} savol qoldi`}
            </Txt>
          </Pressable>
        </View>
      </View>
      {bajarildi === '1' && <Confetti count={26} seed={11} />}
      <HomeworkSentPopup visible={sentOpen} onClose={() => setSentOpen(false)} lessonId={id} lessonNumber={info.number} parts={autoParts} scores={lessonScores} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  pressed: { opacity: 0.85 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  deadline: {
    backgroundColor: '#0B1220',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B2438',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  seg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#26304A',
    overflow: 'hidden',
  },
  partCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partFocused: { borderWidth: 2, borderColor: '#2F5BFF', padding: 12 },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  remember: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F7',
  },
  repeat: {
    borderRadius: 16,
    backgroundColor: '#E3F7EE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  repeatBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footer: { paddingTop: 10, paddingHorizontal: 20, gap: 8 },
  submit: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E7EBF3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
