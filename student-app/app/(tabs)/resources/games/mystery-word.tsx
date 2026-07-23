import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins } from '@/services/coinsStore';
import { playLoseSound, playWinSound } from '@/services/gameSounds';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

// O'quvchining lug'atida aynan 5 harfli so'z yetarli topilmasa ishlatiladigan zaxira.
const FALLBACK_WORDS = ['apple', 'grape', 'house', 'water', 'plant', 'chair', 'brave', 'smile', 'dance', 'light'];
const WORD_LENGTH = 5;
const MAX_TRIES = 6;
const MIN_POOL_SIZE = 3;
const MAX_HINTS = 2;
const RULES_SEEN_KEY = 'mh_mystery_word_rules_seen';

type LetterStatus = 'correct' | 'present' | 'absent';

function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(WORD_LENGTH).fill('absent');
  const answerLetters = answer.split('');
  const used = new Array(WORD_LENGTH).fill(false);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerLetters.findIndex((l, j) => l === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = 'present';
      used[idx] = true;
    }
  }
  return result;
}

function pickAnswer(pool: string[]) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// O'yin qoidalarini va rang-belgilar ma'nosini tushuntiruvchi oyna —
// birinchi marta ochilganda avtomatik chiqadi, keyin ham (i) tugmasi
// orqali istalgan payt qayta ko'rish mumkin.
function RulesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLang();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.rulesBackdrop}>
        <View style={styles.rulesCard}>
          <Pressable style={styles.rulesCloseBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.colors.textMuted} />
          </Pressable>
          <Text style={styles.rulesTitle}>{t('mw_rules_title')}</Text>
          <Text style={styles.rulesText}>
            {t('mw_rules_intro').replace('{n}', String(WORD_LENGTH)).replace('{m}', String(MAX_TRIES))}
          </Text>

          <View style={styles.rulesLegendRow}>
            <View style={[styles.rulesLegendCell, { backgroundColor: theme.colors.textLight }]}>
              <Text style={styles.rulesLegendLetter}>A</Text>
            </View>
            <Text style={styles.rulesLegendText}>{t('mw_rules_absent')}</Text>
          </View>
          <View style={styles.rulesLegendRow}>
            <View style={[styles.rulesLegendCell, { backgroundColor: theme.colors.warning }]}>
              <Text style={styles.rulesLegendLetter}>B</Text>
            </View>
            <Text style={styles.rulesLegendText}>{t('mw_rules_present')}</Text>
          </View>
          <View style={styles.rulesLegendRow}>
            <View style={[styles.rulesLegendCell, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.rulesLegendLetter}>C</Text>
            </View>
            <Text style={styles.rulesLegendText}>{t('mw_rules_correct')}</Text>
          </View>

          <View style={styles.rulesHintNote}>
            <Ionicons name="bulb" size={16} color="#B45309" />
            <Text style={styles.rulesHintNoteText}>
              {t('mw_rules_hint_note').replace('{n}', String(MAX_HINTS))}
            </Text>
          </View>

          <Pressable style={styles.rulesConfirmBtn} onPress={onClose}>
            <Text style={styles.rulesConfirmText}>{t('common_tushunarli')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function MysteryWordGame() {
  const { t } = useLang();
  const [wordPool, setWordPool] = useState<string[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<{ word: string; statuses: LetterStatus[] }[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<'won' | 'lost' | null>(null);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hints, setHints] = useState<{ index: number; letter: string }[]>([]);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((words) => {
      if (cancelled) return;
      const pool = Array.from(
        new Set(
          words
            .map((w) => w.english.toLowerCase())
            .filter((w) => w.length === WORD_LENGTH && /^[a-z]+$/.test(w))
        )
      );
      const finalPool = pool.length >= MIN_POOL_SIZE ? pool : FALLBACK_WORDS;
      setWordPool(finalPool);
      setAnswer(pickAnswer(finalPool));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(RULES_SEEN_KEY).then((seen) => {
      if (cancelled) return;
      if (!seen) {
        setShowRules(true);
        AsyncStorage.setItem(RULES_SEEN_KEY, '1');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const useHint = () => {
    if (!answer || hintsLeft <= 0 || gameOver) return;
    const alreadyHinted = new Set(hints.map((h) => h.index));
    const revealable: number[] = [];
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (!alreadyHinted.has(i)) revealable.push(i);
    }
    if (revealable.length === 0) return;
    const idx = revealable[Math.floor(Math.random() * revealable.length)];
    setHints((h) => [...h, { index: idx, letter: answer[idx] }]);
    setHintsLeft((h) => h - 1);
  };

  const submit = () => {
    if (!answer) return;
    const word = input.trim().toLowerCase();
    if (word.length !== WORD_LENGTH || !/^[a-z]+$/.test(word)) {
      setError(t('mw_error_letters').replace('{n}', String(WORD_LENGTH)));
      return;
    }
    const statuses = evaluateGuess(word, answer);
    const nextGuesses = [...guesses, { word, statuses }];
    setGuesses(nextGuesses);
    setInput('');
    setError(null);

    if (word === answer) {
      addCoins(1);
      addLightning(1);
      setGameOver('won');
      playWinSound();
    } else if (nextGuesses.length >= MAX_TRIES) {
      setGameOver('lost');
      playLoseSound();
    }
  };

  const restart = () => {
    if (!wordPool) return;
    setAnswer(pickAnswer(wordPool));
    setGuesses([]);
    setInput('');
    setError(null);
    setGameOver(null);
    setHintsLeft(MAX_HINTS);
    setHints([]);
  };

  const statusColor = (s: LetterStatus) =>
    s === 'correct' ? theme.colors.success : s === 'present' ? theme.colors.warning : theme.colors.textLight;

  if (!answer) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={t('game_mystery_word_title')} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={t('game_mystery_word_title')}
        showBack
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.hintBtn, hintsLeft === 0 && styles.hintBtnDisabled]}
              onPress={useHint}
              disabled={hintsLeft === 0 || !!gameOver}
              hitSlop={6}>
              <Ionicons name="bulb" size={16} color={hintsLeft === 0 ? theme.colors.textLight : '#B45309'} />
              <Text style={[styles.hintBtnText, hintsLeft === 0 && styles.hintBtnTextDisabled]}>{hintsLeft}</Text>
            </Pressable>
            <Pressable style={styles.infoBtn} onPress={() => setShowRules(true)} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        }
      />

      {hints.length > 0 && (
        <View style={styles.hintsRow}>
          {hints.map((h) => (
            <View key={h.index} style={styles.hintChip}>
              <Text style={styles.hintChipText}>
                {h.index + 1}{t('mw_hint_letter_suffix')} {h.letter.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.board}>
        {guesses.map((g, gi) => (
          <View key={gi} style={styles.row}>
            {g.word.split('').map((letter, li) => (
              <View key={li} style={[styles.cell, { backgroundColor: statusColor(g.statuses[li]) }]}>
                <Text style={styles.cellText}>{letter.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ))}
        {!gameOver &&
          Array.from({ length: MAX_TRIES - guesses.length }).map((_, ri) => (
            <View key={`empty-${ri}`} style={styles.row}>
              {Array.from({ length: WORD_LENGTH }).map((__, ci) => (
                <View key={ci} style={styles.cellEmpty} />
              ))}
            </View>
          ))}
      </View>

      {!gameOver ? (
        <View style={styles.inputBar}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('mw_placeholder').replace('{n}', String(WORD_LENGTH))}
              placeholderTextColor={theme.colors.textLight}
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setError(null);
              }}
              maxLength={WORD_LENGTH}
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
            <Pressable style={styles.submitBtn} onPress={submit}>
              <Text style={styles.submitText}>{t('mw_check_btn')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>{gameOver === 'won' ? '🎉' : '😔'}</Text>
          <Text style={styles.resultTitle}>{gameOver === 'won' ? t('mw_won') : t('mw_lost')}</Text>
          <Text style={styles.resultSub}>{t('mw_answer_label')} {answer.toUpperCase()}</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>{t('game_replay')}</Text>
          </Pressable>
          <CelebrationOverlay visible={gameOver === 'won'} />
        </View>
      )}

      <RulesModal visible={showRules} onClose={() => setShowRules(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  hintBtnDisabled: { backgroundColor: theme.colors.surface },
  hintBtnText: { fontFamily: theme.fonts.bold, fontSize: 13, color: '#B45309' },
  hintBtnTextDisabled: { color: theme.colors.textLight },
  infoBtn: { padding: 2 },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 4, justifyContent: 'center' },
  hintChip: {
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hintChipText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: '#B45309' },
  rulesBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  rulesCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: 22,
  },
  rulesCloseBtn: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  rulesTitle: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 10, paddingRight: 24 },
  rulesText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, marginBottom: 16 },
  rulesLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rulesLegendCell: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rulesLegendLetter: { fontFamily: theme.fonts.extraBold, fontSize: 15, color: '#fff' },
  rulesLegendText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  rulesHintNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.warningBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 18,
  },
  rulesHintNoteText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 12, color: '#92400E', lineHeight: 17 },
  rulesConfirmBtn: { backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center' },
  rulesConfirmText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  board: { alignItems: 'center', paddingTop: 12, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: '#fff' },
  cellEmpty: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  inputBar: { padding: 20 },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.danger, marginBottom: 8, textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.text,
    ...theme.shadow.card,
  },
  submitBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: theme.fonts.bold, fontSize: 13, color: '#fff' },
  resultWrap: { alignItems: 'center', padding: 32 },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 6 },
  resultSub: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, marginBottom: 20 },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
