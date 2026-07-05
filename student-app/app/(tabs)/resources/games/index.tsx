import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useCoins } from '@/services/coinsStore';

type GameItem = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  colors: [string, string];
  route: string;
};

const games: GameItem[] = [
  {
    id: 'word-chain',
    title: "So'nggi harf",
    description: "Keyingi so'z oldingi so'zning oxirgi harfi bilan boshlanadi. O'ynab ko'ring.",
    emoji: '🔤',
    colors: ['#9B7BFF', '#6B4FE0'],
    route: '/resources/games/word-chain',
  },
  {
    id: 'memory-match',
    title: 'Esla-Mosla',
    description: "Rasmlarni eslang va ularni to'g'ri juftlik bilan moslang.",
    emoji: '❓',
    colors: ['#F87171', '#F59E0B'],
    route: '/resources/games/memory-match',
  },
  {
    id: 'word-search',
    title: "So'ztopar",
    description: "Harflar orasiga yashiringan so'zlarni toping.",
    emoji: '🔍',
    colors: ['#D879E8', '#A855F7'],
    route: '/resources/games/word-search',
  },
  {
    id: 'mystery-word',
    title: "Sirli So'z",
    description: "Kataklar ortidagi yashirin so'zni toping.",
    emoji: '🟩',
    colors: ['#FBBF24', '#D97706'],
    route: '/resources/games/mystery-word',
  },
  {
    id: 'face-to-face',
    title: 'Yuzma-Yuz',
    description: "Boshqalar bilan o'ynang va to'g'ri tarjima variantlarini tanlang.",
    emoji: '⚔️',
    colors: ['#7B61FF', '#4F46E5'],
    route: '/battle',
  },
];

export default function GamesScreen() {
  const coins = useCoins();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="O'YINLAR"
        showBack
        rightAction={
          <View style={styles.coinPill}>
            <CoinIcon size={14} />
            <Text style={styles.coinText}>{coins}</Text>
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
                <Text style={styles.cardTitle}>{game.title}</Text>
                <Text style={styles.cardDesc}>{game.description}</Text>
              </View>
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
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
