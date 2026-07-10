import { Ionicons } from '@expo/vector-icons';
import { createElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export function YouTubeEmbed({ url }: { url: string }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  if (Platform.OS === 'web') {
    // react-native-web ilovalari to'g'ridan-to'g'ri ReactDOM orqali render
    // qilinadi, shuning uchun haqiqiy <iframe /> DOM elementini xavfsiz
    // qo'shish mumkin — alohida webview kutubxonasi shart emas.
    return createElement('iframe', {
      src: `https://www.youtube.com/embed/${videoId}`,
      style: { width: '100%', height: '100%', border: 'none', borderRadius: theme.radius.md },
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
    });
  }

  return (
    <Pressable style={styles.wrap} onPress={() => Linking.openURL(url)}>
      <View style={styles.playBtn}>
        <Ionicons name="play" size={32} color="#fff" />
      </View>
      <Text style={styles.label}>YouTube'da ochish</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
});
