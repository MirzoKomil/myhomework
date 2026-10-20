/**
 * Kompyuter: Yuzma-yuz (dizayn: D_Battle, qorong'u fokus ekran).
 *
 * Mantiq telefon bilan bitta (useBattleGame): haqiqiy raqib navbati, 30 s dan
 * keyin "Bot bilan oʻynaysizmi?", server raundlari, wordMix, coin/chaqmoq,
 * ovozlar. Dizaynda faqat o'yin holati bor — qidiruv / bot so'rovi / natija
 * holatlari telefondagi kabi shu maketning o'zida (so'z kartasi va variantlar
 * o'rnida) ko'rsatiladi.
 * Klaviatura: 1–4 — javob, R — qayta tinglash, Esc — chiqish.
 */
import * as Speech from 'expo-speech';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { Confetti } from '@/components/v2/motion';
import { goBack } from '@/components/v2/practice/shared';
import { V2_BATTLE_DAILY_COIN_WINS, V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { leaveBattleQueue } from '@/services/contentApi';

import { H, ICoin, ISpeaker, K, KeyHints, T, web } from './ui';
import { BATTLE_ROUND_SECONDS, QUEUE_WAIT_SECONDS, useBattleGame } from './useBattleGame';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
const MY_AVATAR = img('93faebd4826b1da6adaee5d0dcda6209');
const OPP_AVATAR = img('6fbb4a0364e41f76fd238e0c91d0228b');

export function DBattle() {
  const g = useBattleGame();
  const {
    speechLang,
    lesson,
    myAvatar,
    phase,
    opponentName,
    opponentAvatarUrl,
    matchId,
    queueSecondsLeft,
    queueMessage,
    resultNote,
    winPaid,
    round,
    totalRounds,
    playerScore,
    opponentScore,
    timeLeft,
    selectedOption,
    roundWinner,
    history,
    ranks,
    currentWord,
    oppLabel,
    revealed,
    status,
  } = g;

  const exit = () => {
    g.stopAndLeaveGame();
    goBack(R.practice);
  };
  const replay = () => {
    if (phase === 'playing' && currentWord) Speech.speak(currentWord.word, { language: speechLang, rate: 0.9 });
  };
  const playing = phase === 'playing' && !!currentWord;
  const canAnswer = playing && !revealed && !(!!matchId && selectedOption !== null);
  const answerAt = (i: number) => () => {
    const o = currentWord?.options[i];
    if (o && canAnswer) g.handleAnswer(o);
  };
  useDesktopKeys({ '1': answerAt(0), '2': answerAt(1), '3': answerAt(2), '4': answerAt(3), r: replay });

  const title = `Yuzma-yuz · ${playing ? `Raund ${Math.min(round + 1, totalRounds)} / ${totalRounds}` : phase === 'result' ? 'Oʻyin tugadi' : 'Raqib qidirilmoqda'}`;
  const won = playerScore > opponentScore;
  const seconds = phase === 'matching' ? queueSecondsLeft : phase === 'playing' ? timeLeft : 0;
  const pct = phase === 'matching' ? (queueSecondsLeft / QUEUE_WAIT_SECONDS) * 100 : phase === 'playing' ? (timeLeft / BATTLE_ROUND_SECONDS) * 100 : 0;

  const center = (
    <View style={{ width: 440, gap: 7 }}>
      <View style={s.between}>
        <T w={800} size={13} color="#DCE2EE" lh={18}>
          Raundlar
        </T>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={s.legend}>
            <View style={[s.legendBox, { borderRadius: 3, backgroundColor: '#4D74FF' }]} />
            <T w={700} size={13} color="#B8C1D6" lh={18}>
              Siz
            </T>
          </View>
          <View style={s.legend}>
            <View style={[s.legendBox, { borderRadius: 5, backgroundColor: '#FF7A1A' }]} />
            <T w={700} size={13} color="#B8C1D6" lh={18} lines={1}>
              {oppLabel}
            </T>
          </View>
        </View>
      </View>
      <View accessibilityLabel={`${history.length} raund oʻynaldi`} style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: totalRounds }, (_, i) => {
          const w = history[i];
          const bg = w === 'player' ? '#4D74FF' : w === 'opponent' ? '#FF7A1A' : w === 'draw' ? '#8A93A6' : phase === 'playing' && i === round ? '#FFFFFF' : '#2B3550';
          return <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: bg }} />;
        })}
      </View>
    </View>
  );

  const right = (
    <View style={s.prize}>
      <T w={800} size={14} color="#FFC93C" lh={19}>
        Gʻolib
      </T>
      <ICoin />
      <T w={800} size={14} color="#FFC93C" lh={19}>
        {V2_BATTLE_WIN_COINS} coin oladi
      </T>
    </View>
  );

  // Variantlar o'rnidagi tugmalar (qidiruv / bot so'rovi / natija holatlari).
  const actionBtn = (label: string, onPress: () => void, primary?: boolean) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={[s.option, primary && { backgroundColor: '#2F5BFF', borderColor: '#6F8DFF' }, web({ boxShadow: `0 5px 0 ${primary ? '#1E3FD1' : '#26314D'}` })]}>
      <Text style={s.optionText}>{label}</Text>
    </Pressable>
  );

  return (
    <FocusFrame dark closeTo={R.practice} closeLabel="Oʻyindan chiqish (Esc)" onClose={exit} title={title} subtitle={lesson ? `${lesson.number}-dars soʻzlari` : 'Dars soʻzlari'} center={center} right={right}>
      <View style={s.body}>
        <View style={s.col}>
          <View accessibilityLabel="Hisob" style={s.scoreCard}>
            <View style={[s.side, { justifyContent: 'flex-start' }]}>
              <Image source={myAvatar ? { uri: myAvatar } : MY_AVATAR} accessibilityLabel="Siz avatari" style={[s.avatar, { borderColor: '#4D74FF' }]} />
              <View style={{ gap: 2 }}>
                <T w={800} size={26} color="#FFFFFF" lh={36}>
                  Siz
                </T>
                <T w={700} size={15} color="#B8C1D6" lh={20}>
                  {ranks.me ? `${ranks.me}-oʻrin` : ' '}
                </T>
              </View>
            </View>
            <View accessibilityLabel={`Hisob ${playerScore} ga ${opponentScore}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Text style={[s.score, { color: '#8EA6FF' }]}>{playerScore}</Text>
              <Text style={[s.score, { color: '#8792AA', fontSize: 48, lineHeight: 48 }]}>:</Text>
              <Text style={[s.score, { color: '#FFA764' }]}>{opponentScore}</Text>
            </View>
            <View style={[s.side, { justifyContent: 'flex-end' }]}>
              <View style={{ gap: 2, alignItems: 'flex-end', flexShrink: 1 }}>
                <T w={800} size={26} color="#FFFFFF" lh={36} lines={1}>
                  {opponentName || '…'}
                </T>
                <T w={700} size={15} color="#B8C1D6" lh={20}>
                  {ranks.opp ? `${ranks.opp}-oʻrin` : ' '}
                </T>
              </View>
              <Image
                source={opponentAvatarUrl ? { uri: opponentAvatarUrl } : OPP_AVATAR}
                accessibilityLabel={`${oppLabel} avatari`}
                style={[s.avatar, { borderColor: '#FF7A1A' }, !opponentName && { opacity: 0.35 }]}
              />
            </View>
          </View>

          <View style={{ gap: 9 }}>
            <View accessibilityRole="timer" accessibilityLabel={`${seconds} soniya qoldi`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={s.track}>
                <View style={[s.fill, { width: `${pct}%` }]} />
              </View>
              <T w={800} size={20} color="#FFC93C" lh={27} style={{ width: 40, textAlign: 'right' }}>
                {seconds} s
              </T>
            </View>
            <View style={s.between}>
              <T w={700} size={15} color="#B8C1D6" lh={20}>
                Tez javob = koʻproq ball
              </T>
              {!!status && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                  <View style={s.thinkDot} />
                  <T w={700} size={15} color="#FFA764" lh={20} lines={1}>
                    {status}
                  </T>
                </View>
              )}
            </View>
          </View>

          <View style={s.wordCard}>
            <View style={s.speakRing}>
              <Pressable accessibilityRole="button" accessibilityLabel="Soʻzni qayta tinglash (R)" onPress={replay} style={s.speakBtn}>
                <ISpeaker />
              </Pressable>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
              {playing && currentWord ? (
                <>
                  <H size={36} lh={43} color="#FFFFFF">
                    Tinglang va tarjimasini tanlang
                  </H>
                  {revealed ? (
                    <T w={800} size={28} color="#FFFFFF" lh={22}>
                      {currentWord.word}
                    </T>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {Array.from({ length: Math.min(Math.max(currentWord.word.length, 3), 6) }, (_, i) => (
                          <View key={i} style={s.dash} />
                        ))}
                      </View>
                      <T w={700} size={16} color="#B8C1D6" lh={22} style={{ marginLeft: 8 }}>
                        Soʻz javobdan keyin ochiladi
                      </T>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <K tone="battle">R</K>
                    <T w={700} size={14} color="#B8C1D6" lh={19}>
                      qayta tinglash
                    </T>
                  </View>
                </>
              ) : phase === 'result' ? (
                <>
                  <H size={36} lh={43} color="#FFFFFF">
                    {won ? 'Gʻalaba!' : playerScore === opponentScore ? 'Durrang' : 'Magʻlubiyat'}
                  </H>
                  <T w={700} size={16} color="#B8C1D6" lh={22}>
                    Siz {playerScore} — {opponentScore} {oppLabel}
                    {won && winPaid ? ` · +${V2_BATTLE_WIN_COINS} coin` : ''}
                  </T>
                  {won && winPaid === false && (
                    <T w={700} size={16} color="#B8C1D6" lh={22}>
                      {`Bugungi coinli gʻalabalar tugadi (${V2_BATTLE_DAILY_COIN_WINS}/${V2_BATTLE_DAILY_COIN_WINS})`}
                    </T>
                  )}
                  {!!resultNote && (
                    <T w={700} size={16} color="#B8C1D6" lh={22}>
                      {resultNote}
                    </T>
                  )}
                </>
              ) : (
                <>
                  <H size={36} lh={43} color="#FFFFFF">
                    {phase === 'matching' ? 'Raqib qidirilmoqda…' : 'Bot bilan oʻynaysizmi?'}
                  </H>
                  <T w={700} size={16} color="#B8C1D6" lh={22}>
                    {phase === 'matching' ? 'Boshqa oʻquvchi navbatga qoʻshilishi kutilmoqda' : queueMessage}
                  </T>
                </>
              )}
            </View>
            <Image source={img('11ac32c8e5b061e3779348e3afc56d83')} style={{ width: 170, height: 160 }} resizeMode="contain" />
          </View>

          {playing && currentWord ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Javob variantlari" style={s.options}>
              {currentWord.options.map((o, i) => {
                const isCorrect = o === currentWord.translation;
                const isSel = o === selectedOption;
                const bg = revealed && isCorrect ? '#087A4A' : revealed && isSel ? '#B42318' : isSel ? '#2F5BFF' : '#172038';
                const bc = revealed && isCorrect ? '#0FA968' : revealed && isSel ? '#D92D20' : isSel ? '#6F8DFF' : '#26314D';
                return (
                  <Pressable
                    key={o}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSel }}
                    aria-keyshortcuts={String(i + 1)}
                    disabled={!canAnswer}
                    onPress={() => g.handleAnswer(o)}
                    style={[s.option, { backgroundColor: bg, borderColor: bc }, web({ boxShadow: `0 5px 0 ${bc}` })]}
                  >
                    <View style={s.optKbd}>
                      <K tone="battle">{String(i + 1)}</K>
                    </View>
                    <Text style={s.optionText} numberOfLines={2}>
                      {o}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : phase === 'matching' ? (
            <View style={s.options}>
              {actionBtn('Bekor qilish', g.giveUpQueue)}
              {actionBtn('Bot bilan', () => {
                leaveBattleQueue().catch(() => {});
                g.startMatch('bot');
              })}
            </View>
          ) : phase === 'notFound' ? (
            <View style={s.options}>
              {actionBtn('Yana qidirish', () => g.startMatch('random'))}
              {actionBtn('Bot bilan oʻynash', () => g.startMatch('bot'), true)}
            </View>
          ) : phase === 'result' ? (
            <View style={s.options}>{actionBtn('Yana oʻynash', () => g.startMatch('random'), true)}</View>
          ) : null}

          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <KeyHints
              tone="battle"
              color="#B8C1D6"
              items={[
                [['1', '2', '3', '4'], 'javob'],
                [['R'], 'qayta tinglash'],
                [['Esc'], 'chiqish'],
              ]}
            />
          </View>
        </View>
      </View>
      {phase === 'result' && won && <Confetti count={34} />}
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 10, height: 10 },
  prize: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#2A2310', flexDirection: 'row', alignItems: 'center', gap: 7 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  col: { width: 1100, maxWidth: '100%', gap: 26, paddingHorizontal: 0 },
  scoreCard: { backgroundColor: '#131C30', borderRadius: 28, paddingVertical: 22, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', gap: 20 },
  side: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, backgroundColor: '#FFF1E6' },
  score: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 80, lineHeight: 80, letterSpacing: -1.6 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#1F2940', overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6, backgroundColor: '#FFC93C' },
  thinkDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF7A1A' },

  wordCard: { backgroundColor: '#131C30', borderRadius: 28, paddingVertical: 26, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', gap: 40 },
  speakRing: { width: 168, height: 168, borderRadius: 84, backgroundColor: '#1B2540', alignItems: 'center', justifyContent: 'center' },
  speakBtn: { width: 124, height: 124, borderRadius: 62, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  dash: { width: 40, height: 10, borderRadius: 5, backgroundColor: '#2B3550' },

  options: { flexDirection: 'row', gap: 16 },
  option: {
    flex: 1,
    height: 120,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#26314D',
    backgroundColor: '#172038',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optKbd: { position: 'absolute', left: 14, top: 12 },
  optionText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 26, lineHeight: 34, color: '#FFFFFF', textAlign: 'center' },
});
