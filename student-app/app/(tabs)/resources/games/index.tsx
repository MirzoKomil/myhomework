import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { LightningInfoModal } from '@/components/ui/LightningInfoModal';
import { LightningPill } from '@/components/ui/LightningIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { useCoins } from '@/services/coinsStore';
import { useLightning } from '@/services/lightningStore';

type GameItem = {
  id: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  emoji: string;
  colors: [string, string];
  route: string;
};

const games: GameItem[] = [
  {
    id: 'word-chain',
    titleKey: 'game_word_chain_title',
    descKey: 'game_word_chain_desc',
    emoji: '🔤',
    colors: ['#9B7BFF', '#6B4FE0'],
    route: '/resources/games/word-chain',
  },
  {
    id: 'memory-match',
    titleKey: 'game_memory_match_title',
    descKey: 'game_memory_match_desc',
    emoji: '❓',
    colors: ['#F87171', '#F59E0B'],
    route: '/resources/games/memory-match',
  },
  {
    id: 'word-search',
    titleKey: 'game_word_search_title',
    descKey: 'game_word_search_desc',
    emoji: '🔍',
    colors: ['#D879E8', '#A855F7'],
    route: '/resources/games/word-search',
  },
  {
    id: 'mystery-word',
    titleKey: 'game_mystery_word_title',
    descKey: 'game_mystery_word_desc',
    emoji: '🟩',
    colors: ['#FBBF24', '#D97706'],
    route: '/resources/games/mystery-word',
  },
  {
    id: 'face-to-face',
    titleKey: 'game_face_to_face_title',
    descKey: 'game_face_to_face_desc',
    emoji: '⚔️',
    colors: ['#7B61FF', '#4F46E5'],
    route: '/battle',
  },
];

export default function GamesScreen() {
  const { t } = useLang();
  const coins = useCoins();
  const lightning = useLightning();
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [showLightningInfo, setShowLightningInfo] = useState(false);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={t('games_title')}
        showBack
        rightAction={
          <View style={styles.headerPillRow}>
            <Pressable style={styles.coinPill} onPress={() => setShowCoinInfo(true)}>
              <CoinIcon size={12} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
            <Pressable onPress={() => setShowLightningInfo(true)}>
              <LightningPill amount={lightning} size={12} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {games.map((game) => (
          <Pressable key={game.id} onPress={() => router.push(game.route as never)}>
            <LinearGradient
              colors={game.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{t(game.titleKey)}</Text>
                <Text style={styles.cardDesc}>{t(game.descKey)}</Text>
              </View>
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
      <LightningInfoModal visible={showLightningInfo} onClose={() => setShowLightningInfo(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  headerPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  coinEmoji: { fontSize: 14 },
  coinText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#B45309' },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 32, gap: 16 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 20,
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardText: { flex: 1, paddingRight: 12 },
  cardTitle: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: '#fff', marginBottom: 6 },
  cardDesc: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 17 },
  cardEmoji: { fontSize: 40 },
});
