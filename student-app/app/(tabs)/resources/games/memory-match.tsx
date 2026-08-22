import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins } from '@/services/coinsStore';
import { playWinSound } from '@/services/gameSounds';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

// O'quvchining lug'atida yetarli so'z topilmasa ishlatiladigan zaxira.
const FALLBACK_ITEMS: { word: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { word: 'apple', icon: 'restaurant-outline' },
  { word: 'window', icon: 'walk-outline' },
  { word: 'friend', icon: 'people-outline' },
  { word: 'happy', icon: 'happy-outline' },
  { word: 'travel', icon: 'airplane-outline' },
  { word: 'kitchen', icon: 'flame-outline' },
  { word: 'weather', icon: 'partly-sunny-outline' },
  { word: 'teacher', icon: 'school-outline' },
  { word: 'book', icon: 'book-outline' },
];
// 13-vazifa: rus tili kursi uchun alohida zaxira (A1/A2 darajadagi so'zlar).
const FALLBACK_ITEMS_RU: { word: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { word: 'яблоко', icon: 'restaurant-outline' },
  { word: 'друг', icon: 'people-outline' },
  { word: 'счастье', icon: 'happy-outline' },
  { word: 'самолёт', icon: 'airplane-outline' },
  { word: 'кухня', icon: 'flame-outline' },
  { word: 'погода', icon: 'partly-sunny-outline' },
  { word: 'учитель', icon: 'school-outline' },
  { word: 'книга', icon: 'book-outline' },
  { word: 'дом', icon: 'home-outline' },
  { word: 'вода', icon: 'water-outline' },
  { word: 'собака', icon: 'paw-outline' },
  { word: 'одежда', icon: 'shirt-outline' },
  { word: 'телефон', icon: 'phone-portrait-outline' },
  { word: 'облако', icon: 'cloud-outline' },
  { word: 'врач', icon: 'medkit-outline' },
  { word: 'спорт', icon: 'football-outline' },
  { word: 'ночь', icon: 'moon-outline' },
];
const ITEM_COUNT = 9;
const MIN_POOL_SIZE = 6;

type Item = { id: string; word: string; icon: keyof typeof Ionicons.glyphMap };
type SlotStatus = 'empty' | 'correct' | 'wrong';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'study' | 'match' | 'result';

export default function MemoryMatchGame() {
  const { t, courseLang } = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [phase, setPhase] = useState<Phase>('study');
  const [slotFill, setSlotFill] = useState<Record<string, string | null>>({});
  const [slotStatus, setSlotStatus] = useState<Record<string, SlotStatus>>({});
  const [chipIds, setChipIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [rewardCoins, setRewardCoins] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isRu = courseLang === 'russian';
    const letterRe = isRu ? /^[а-яё]+$/i : /^[a-z]+$/;
    const fallbackItems = isRu ? FALLBACK_ITEMS_RU : FALLBACK_ITEMS;
    getAccumulatedVocabulary().then((words) => {
      if (cancelled) return;
      const uniq = new Map<string, keyof typeof Ionicons.glyphMap>();
      for (const w of words) {
        const key = w.english.toLowerCase();
        if (letterRe.test(key) && !uniq.has(key)) uniq.set(key, w.icon);
      }
      const pool = Array.from(uniq.entries()).map(([word, icon]) => ({ word, icon }));
      const source = pool.length >= MIN_POOL_SIZE
        ? [...pool, ...fallbackItems.filter((fallback) => !uniq.has(fallback.word))]
        : fallbackItems;
      const picked = shuffle(source)
        .slice(0, ITEM_COUNT)
        .map((p, i) => ({ id: `item-${i}-${p.word}`, word: p.word, icon: p.icon }));
      setItems(picked);
    }).catch(() => {
      // Tarmoq xatosi bo'lsa (masalan sekin internet) o'yin abadiy "yuklanmoqda"
      // holatida qolib ketmasin — zaxira so'zlar bilan baribir boshlanadi.
      if (cancelled) return;
      const picked = shuffle(fallbackItems)
        .slice(0, ITEM_COUNT)
        .map((p, i) => ({ id: `item-${i}-${p.word}`, word: p.word, icon: p.icon }));
      setItems(picked);
    });
    return () => {
      cancelled = true;
    };
  }, [courseLang]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startMatch = () => {
    if (!items) return;
    const fill: Record<string, string | null> = {};
    const status: Record<string, SlotStatus> = {};
    items.forEach((it) => {
      fill[it.id] = null;
      status[it.id] = 'empty';
    });
    setSlotFill(fill);
    setSlotStatus(status);
    setChipIds(shuffle(items.map((it) => it.id)));
    setMoves(0);
    setSeconds(0);
    setSelectedChipId(null);
    setRewardCoins(0);
    setPhase('match');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('study');
    setSelectedChipId(null);
    setRewardCoins(0);
  };

  const finishIfComplete = (fill: Record<string, string | null>) => {
    if (!items) return;
    const allCorrect = items.every((it) => fill[it.id] === it.id);
    if (allCorrect) {
      if (timerRef.current) clearInterval(timerRef.current);
      const reward = items.length;
      setRewardCoins(reward);
      addCoins(reward);
      addLightning(items.length);
      setPhase('result');
      playWinSound();
    }
  };

  // 21-vazifa: PanResponder asosidagi sudrab-tashlash (drag-and-drop) real
  // qurilmalarda barqaror ishlamadi (masalan react-native-web'da PanResponder
  // touch koordinatalari va measureInWindow o'lchamlari ba'zi brauzerlarda
  // to'g'ri kelmaydi) — natijada so'z hech qachon katakka "yopishmasdi".
  // Ilovaning boshqa moslashtirish (matching) mashqlarida ishlatiladigan,
  // ishonchli usulga o'tildi: avval so'z bosiladi (tanlanadi), keyin mos
  // katakka bosiladi — hech qanday sudrash/koordinata hisob-kitobi kerak emas.
  const selectChip = (chipId: string) => {
    setSelectedChipId((prev) => (prev === chipId ? null : chipId));
  };

  const placeChipInSlot = (chipId: string, slotId: string) => {
    if (!items || slotFill[slotId]) return;
    setMoves((m) => m + 1);
    setSelectedChipId(null);

    if (slotId === chipId) {
      setSlotFill((fill) => {
        if (fill[slotId]) return fill;
        const next = { ...fill, [slotId]: chipId };
        finishIfComplete(next);
        return next;
      });
      setSlotStatus((status) => ({ ...status, [slotId]: 'correct' }));
      setChipIds((ids) => ids.filter((id) => id !== chipId));
      return;
    }

    setSlotStatus((status) => ({ ...status, [slotId]: 'wrong' }));
    setTimeout(() => {
      setSlotStatus((status) => (status[slotId] === 'wrong' ? { ...status, [slotId]: 'empty' } : status));
    }, 500);
  };

  const matchedCount = items ? items.filter((it) => slotFill[it.id] === it.id).length : 0;
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!items) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={t('game_memory_match_title')} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Esla-Mosla"
          showBack
          rightAction={
            phase === 'match' ? (
              <Pressable onPress={restart}>
                <Text style={styles.restartLink}>{t('mm_restart')}</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {phase === 'match' && (
        <View style={styles.statsRow}>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(seconds)}</Text>
          </View>
        </View>
      )}

      {phase === 'result' ? (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>{t('mm_all_found')}</Text>
          <Text style={styles.resultSub}>
            {t('mm_time_moves_result').replace('{time}', formatTime(seconds)).replace('{moves}', String(moves))}
          </Text>
          <View style={styles.rewardPill}>
            <Ionicons name="logo-bitcoin" size={20} color="#B45309" />
            <Text style={styles.rewardText}>+{rewardCoins} coin</Text>
          </View>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>{t('game_replay')}</Text>
          </Pressable>
          <CelebrationOverlay visible={phase === 'result'} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {items.map((it) => {
              const filledChipId = slotFill[it.id];
              const status = slotStatus[it.id] ?? 'empty';
              return (
                <View key={it.id} style={styles.cell}>
                  <View style={styles.iconTile}>
                    <Ionicons name={it.icon} size={30} color={theme.colors.purple} />
                  </View>
                  {phase === 'study' ? (
                    <Text style={styles.cellWord} numberOfLines={1}>
                      {it.word}
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (selectedChipId) placeChipInSlot(selectedChipId, it.id);
                      }}
                      style={[
                        styles.dropSlot,
                        selectedChipId && status === 'empty' && styles.dropSlotReady,
                        status === 'correct' && styles.dropSlotCorrect,
                        status === 'wrong' && styles.dropSlotWrong,
                      ]}>
                      {filledChipId ? (
                        <Text style={styles.dropSlotText} numberOfLines={1}>
                          {it.word}
                        </Text>
                      ) : status === 'wrong' ? (
                        <Ionicons name="close" size={16} color={theme.colors.danger} />
                      ) : null}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {phase === 'study' ? (
            <View style={styles.studyFooter}>
              <View style={styles.hintPill}>
                <Ionicons name="information-circle" size={16} color={theme.colors.purple} />
                <Text style={styles.hintPillText}>{t('mm_memorize_hint')}</Text>
              </View>
              <Pressable style={styles.memorizedBtn} onPress={startMatch}>
                <Text style={styles.memorizedBtnText}>{t('mm_memorized_btn')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.dragHint}>{t('mm_drag_hint')}</Text>
              <View style={styles.chipBank}>
                {chipIds.map((chipId) => {
                  const item = items.find((it) => it.id === chipId)!;
                  return (
                    <Pressable
                      key={chipId}
                      onPress={() => selectChip(chipId)}
                      style={[styles.chip, selectedChipId === chipId && styles.chipSelected]}>
                      <Text style={[styles.chipText, selectedChipId === chipId && styles.chipTextSelected]}>{item.word}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {},
  restartLink: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },
  statsRow: { alignItems: 'center', marginBottom: 8 },
  timerBadge: {
    backgroundColor: theme.colors.purpleLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  timerText: { fontFamily: theme.fonts.extraBold, fontSize: 14, color: theme.colors.purple },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    justifyContent: 'center',
  },
  cell: { width: '30%', alignItems: 'center', gap: 6, marginBottom: 4 },
  iconTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  cellWord: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  dropSlot: {
    width: '100%',
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropSlotReady: { borderColor: theme.colors.purple, backgroundColor: theme.colors.purpleLight },
  dropSlotCorrect: { borderStyle: 'solid', borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  dropSlotWrong: { borderStyle: 'solid', borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  dropSlotText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.success },
  studyFooter: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: theme.colors.purpleLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintPillText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.purple },
  memorizedBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  memorizedBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  dragHint: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 16,
  },
  chipBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  chip: {
    minWidth: 90,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
    userSelect: 'none',
  } as any,
  chipSelected: { backgroundColor: theme.colors.purple, borderWidth: 2, borderColor: '#fff' },
  chipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, userSelect: 'none' } as any,
  chipTextSelected: { color: '#fff' },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 56, marginBottom: 14 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 6 },
  resultSub: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 24, textAlign: 'center' },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -12,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
  },
  rewardText: { fontFamily: theme.fonts.extraBold, fontSize: 15, color: '#B45309' },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
