import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';

export default function ResourcesScreen() {
  const [showInfo, setShowInfo] = useState(false);
  const { t } = useLang();

  const libraryShimmer = useRef(new Animated.Value(0)).current;
  const gamesShimmer = useRef(new Animated.Value(0)).current;
  const communityShimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(libraryShimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(libraryShimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(gamesShimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(gamesShimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(communityShimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(communityShimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [libraryShimmer, gamesShimmer, communityShimmer]);

  const libraryTranslate = libraryShimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 400] });
  const gamesTranslate = gamesShimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 400] });
  const communityTranslate = communityShimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 400] });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('res_hub_title')}</Text>
        <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
          <Text style={styles.bulbEmoji}>💡</Text>
        </Pressable>
      </View>

      <View style={styles.wrap}>
        <Pressable style={styles.cardWrap} onPress={() => router.push('/resources/library' as never)}>
          <LinearGradient colors={['#6FA8FF', '#4F8CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.emoji}>📚</Text>
            <Text style={styles.title}>{t('res_hub_library_title')}</Text>
            <Text style={styles.subtitle}>{t('res_hub_library_subtitle')}</Text>
            <View style={styles.shimmerClip} pointerEvents="none">
              <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: libraryTranslate }, { rotate: '20deg' }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.cardWrap} onPress={() => router.push('/resources/games' as never)}>
          <LinearGradient colors={['#F0807D', '#D65656']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.emoji}>🎮</Text>
            <Text style={styles.title}>{t('res_hub_games_title')}</Text>
            <Text style={styles.subtitle}>{t('res_hub_games_subtitle')}</Text>
            <View style={styles.shimmerClip} pointerEvents="none">
              <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: gamesTranslate }, { rotate: '20deg' }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.cardWrap} onPress={() => router.push('/community' as never)}>
          <LinearGradient colors={['#9B7BFF', '#6B4FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.emoji}>👥</Text>
            <Text style={styles.title}>{t('res_hub_community_title')}</Text>
            <Text style={styles.subtitle}>{t('res_hub_community_subtitle')}</Text>
            <View style={styles.shimmerClip} pointerEvents="none">
              <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: communityTranslate }, { rotate: '20deg' }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogEmoji}>💡</Text>
            <Text style={styles.dialogTitle}>{t('res_hub_info_title')}</Text>
            <Text style={styles.dialogSubtitle}>
              {t('res_hub_info_intro')} {'\n\n'}
              📚 <Text style={styles.dialogBold}>{t('res_hub_library_title')}</Text> — {t('res_hub_info_library_desc')}{'\n\n'}
              🎮 <Text style={styles.dialogBold}>{t('res_hub_games_title')}</Text> — {t('res_hub_info_games_desc')}{'\n\n'}
              👥 <Text style={styles.dialogBold}>{t('res_hub_community_title')}</Text> — {t('res_hub_info_community_desc')}
            </Text>
            <Pressable style={styles.dialogBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.dialogBtnText}>{t('common_tushunarli')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  bulbEmoji: { fontSize: 18 },
  wrap: { padding: 20, paddingTop: 4, gap: 16 },
  cardWrap: { height: 160 },
  card: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: -40, bottom: -40, width: 100 },
  emoji: { fontSize: 32, marginBottom: 10 },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: '#fff', marginBottom: 6 },
  subtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogEmoji: { fontSize: 36 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'left', lineHeight: 20 },
  dialogBold: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
  dialogBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
