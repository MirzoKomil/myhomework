import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
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
];
const ITEM_COUNT = 8;
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
  const { t } = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [phase, setPhase] = useState<Phase>('study');
  const [slotFill, setSlotFill] = useState<Record<string, string | null>>({});
  const [slotStatus, setSlotStatus] = useState<Record<string, SlotStatus>>({});
  const [chipIds, setChipIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [dragChip, setDragChip] = useState<{ id: string; word: string; x: number; y: number } | null>(null);

  const slotRefs = useRef<Record<string, View | null>>({});
  const slotRects = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const chipSize = useRef({ w: 100, h: 44 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((words) => {
      if (cancelled) return;
      const uniq = new Map<string, keyof typeof Ionicons.glyphMap>();
      for (const w of words) {
        const key = w.english.toLowerCase();
        if (/^[a-z]+$/.test(key) && !uniq.has(key)) uniq.set(key, w.icon);
      }
      const pool = Array.from(uniq.entries()).map(([word, icon]) => ({ word, icon }));
      const source = pool.length >= MIN_POOL_SIZE ? pool : FALLBACK_ITEMS;
      const picked = shuffle(source)
        .slice(0, ITEM_COUNT)
        .map((p, i) => ({ id: `item-${i}-${p.word}`, word: p.word, icon: p.icon }));
      setItems(picked);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setPhase('match');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('study');
  };

  const finishIfComplete = (fill: Record<string, string | null>) => {
    if (!items) return;
    const allCorrect = items.every((it) => fill[it.id] === it.id);
    if (allCorrect) {
      if (timerRef.current) clearInterval(timerRef.current);
      addCoins(items.length);
      addLightning(items.length);
      setPhase('result');
      playWinSound();
    }
  };

  const snapshotSlotRects = (onDone: () => void) => {
    if (!items || items.length === 0) {
      onDone();
      return;
    }
    let remaining = items.length;
    items.forEach((it) => {
      const ref = slotRefs.current[it.id];
      if (!ref) {
        remaining--;
        if (remaining === 0) onDone();
        return;
      }
      ref.measure((_x, _y, w, h, pageX, pageY) => {
        slotRects.current[it.id] = { x: pageX, y: pageY, w, h };
        remaining--;
        if (remaining === 0) onDone();
      });
    });
  };

  const makePanResponder = (chipId: string, word: string) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_evt, gestureState) => {
        const { moveX, moveY, x0, y0 } = gestureState;
        const px = moveX || x0;
        const py = moveY || y0;
        setDragChip({ id: chipId, word, x: px - chipSize.current.w / 2, y: py - chipSize.current.h / 2 });
        snapshotSlotRects(() => {});
      },
      onPanResponderMove: (_evt, gestureState) => {
        const { moveX, moveY } = gestureState;
        setDragChip((d) => (d ? { ...d, x: moveX - chipSize.current.w / 2, y: moveY - chipSize.current.h / 2 } : d));
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { moveX, moveY } = gestureState;
        const pageX = moveX;
        const pageY = moveY;
        let droppedOn: string | null = null;
        for (const [slotId, rect] of Object.entries(slotRects.current)) {
          if (pageX >= rect.x && pageX <= rect.x + rect.w && pageY >= rect.y && pageY <= rect.y + rect.h) {
            droppedOn = slotId;
            break;
          }
        }
        setDragChip(null);
        if (!droppedOn || !items) return;
        if (slotFill[droppedOn]) return; // slot band edi

        setMoves((m) => m + 1);
        if (droppedOn === chipId) {
          setSlotFill((f) => {
            const next = { ...f, [droppedOn as string]: chipId };
            finishIfComplete(next);
            return next;
          });
          setSlotStatus((s) => ({ ...s, [droppedOn as string]: 'correct' }));
          setChipIds((ids) => ids.filter((id) => id !== chipId));
        } else {
          setSlotStatus((s) => ({ ...s, [droppedOn as string]: 'wrong' }));
          setTimeout(() => {
            setSlotStatus((s) => (s[droppedOn as string] === 'wrong' ? { ...s, [droppedOn as string]: 'empty' } : s));
          }, 500);
        }
      },
    });

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
                    <View
                      ref={(r) => {
                        slotRefs.current[it.id] = r;
                      }}
                      style={[
                        styles.dropSlot,
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
                    </View>
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
                  const responder = makePanResponder(chipId, item.word);
                  const isDragging = dragChip?.id === chipId;
                  return (
                    <View key={chipId} style={[styles.chip, isDragging && styles.chipGhost]} {...responder.panHandlers}>
                      <Text style={styles.chipText}>{item.word}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {dragChip && (
        <View pointerEvents="none" style={[styles.dragOverlay, { left: dragChip.x, top: dragChip.y }]}>
          <Text style={styles.chipText}>{dragChip.word}</Text>
        </View>
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
    // Veb'da so'zni sudrab tashlashga harakat qilinganda brauzer standart
    // matn tanlash (text-selection) xatti-harakatini boshlab yuborishi va
    // PanResponder'ning tortish (drag) jestini "o'g'irlab ketishi" mumkin —
    // shuning uchun chip matnini tanlab bo'lmaydigan qilib qo'yamiz.
    userSelect: 'none',
    touchAction: 'none',
  } as any,
  chipGhost: { opacity: 0.25 },
  chipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, userSelect: 'none' } as any,
  dragOverlay: {
    position: 'absolute',
    minWidth: 100,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
    zIndex: 999,
  },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 56, marginBottom: 14 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 6 },
  resultSub: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 24, textAlign: 'center' },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
