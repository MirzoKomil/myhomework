import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { radioAnnouncements, radioStations, RadioStation } from '@/data/mock';
import { useLang } from '@/i18n/LanguageContext';

const ANNOUNCEMENT_INTERVAL = 3500;

function StationRow({ station }: { station: RadioStation }) {
  return (
    <Pressable style={styles.stationRow} onPress={() => router.push(`/radio/${station.id}` as never)}>
      {station.logo ? (
        <View style={styles.stationIcon}>
          <Image source={station.logo} style={styles.stationLogoImg} resizeMode="cover" />
        </View>
      ) : (
        <LinearGradient
          colors={station.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stationIcon}>
          <Text style={styles.stationFlag}>{station.flag}</Text>
        </LinearGradient>
      )}
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{station.name}</Text>
        <Text style={styles.stationGenre}>{station.genre}</Text>
      </View>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </Pressable>
  );
}

export default function RadioScreen() {
  const [activeSlide, setActiveSlide] = useState(0);
  const { courseLang } = useLang();
  const isRussianCourse = courseLang === 'russian';
  const announcements = radioAnnouncements.filter((a) => !a.lang || a.lang === courseLang);

  useEffect(() => {
    setActiveSlide(0);
    const id = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % announcements.length);
    }, ANNOUNCEMENT_INTERVAL);
    return () => clearInterval(id);
  }, [announcements.length]);

  const ukStations = radioStations.filter((s) => s.country === 'UK');
  const usStations = radioStations.filter((s) => s.country === 'US');
  const ruStations = radioStations.filter((s) => s.country === 'RU');
  const homeworkStations = radioStations.filter((s) => s.country === 'Homework');
  const announcement = announcements[activeSlide];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Radio" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={announcement.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}>
          <Text style={styles.bannerTitle}>{announcement.title}</Text>
          <Text style={styles.bannerSubtitle}>{announcement.subtitle}</Text>
          <View style={styles.dotsRow}>
            {announcements.map((item, i) => (
              <View key={item.id} style={[styles.dot, i === activeSlide && styles.dotActive]} />
            ))}
          </View>
        </LinearGradient>

        {isRussianCourse ? (
          <>
            <Text style={styles.sectionTitle}>🇷🇺 Rossiya radiolari</Text>
            {ruStations.map((station) => (
              <StationRow key={station.id} station={station} />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>🇺🇸 Amerika radiolari</Text>
            {usStations.map((station) => (
              <StationRow key={station.id} station={station} />
            ))}

            <Text style={styles.sectionTitle}>🇬🇧 Britaniya radiolari</Text>
            {ukStations.map((station) => (
              <StationRow key={station.id} station={station} />
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>🎓 Homework Radio</Text>
        {homeworkStations.map((station) => (
          <StationRow key={station.id} station={station} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  banner: { borderRadius: theme.radius.lg, padding: 22, marginBottom: 24 },
  bannerTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: '#fff', marginBottom: 6 },
  bannerSubtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginBottom: 10, marginTop: 6 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...theme.shadow.card,
  },
  stationIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#fff' },
  stationLogoImg: { width: '100%', height: '100%' },
  stationFlag: { fontSize: 20 },
  stationInfo: { flex: 1 },
  stationName: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  stationGenre: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dangerBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger },
  liveText: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.danger },
});
