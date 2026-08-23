import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { VocabWord } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';

type Props = {
  word: VocabWord | null;
  lang: 'english' | 'russian';
  onClose: () => void;
};

// 58-vazifa (4-vazifa qoshimcha: pastdan chiqadigan yarim oyna o'rniga,
// ilovadagi boshqa ma'lumot oynachalari — masalan "Yetkazib berish
// xizmati" — bilan bir xil uslubda EKRAN O'RTASIDA chiqadigan kartaga
// almashtirildi, ko'rinishi izchil bo'lishi uchun) — so'z ustiga bosilganda
// ochilib, rasm, so'z, tarjima, talaffuz tugmasi va (bo'lsa) misol gapni
// ko'rsatadi. Rasm va misol gap CRM'dan (admin) kiritiladi — kiritilmagan
// bo'lsa rasm o'rniga zaxira icon ko'rsatiladi, misol gap qismi esa
// umuman chiqmaydi.
export function VocabWordSheet({ word, lang, onClose }: Props) {
  const { t } = useLang();
  const speechLang = lang === 'russian' ? 'ru-RU' : 'en-US';

  return (
    <Modal visible={!!word} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={theme.colors.textMuted} />
          </Pressable>
          {word && (
            <>
              <View style={styles.imageWrap}>
                {word.imageUrl ? (
                  <Image source={{ uri: word.imageUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imageFallback}>
                    <Ionicons name={word.icon} size={56} color={theme.colors.purple} />
                  </View>
                )}
              </View>
              <View style={styles.headRow}>
                <Text style={styles.wordText}>{word.english}</Text>
                <Pressable
                  style={styles.speakerBtn}
                  onPress={() => Speech.speak(word.english, { language: speechLang, rate: 0.9 })}
                  hitSlop={8}>
                  <Ionicons name="volume-high" size={20} color="#fff" />
                </Pressable>
              </View>
              {!!word.transcript && <Text style={styles.transcript}>{word.transcript}</Text>}
              <Text style={styles.translation}>{word.translation}</Text>
              {!!word.exampleSentence && (
                <View style={styles.exampleCard}>
                  <Text style={styles.exampleLabel}>{t('vw_example_label')}</Text>
                  <Text style={styles.exampleText}>{word.exampleSentence}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: 24,
    gap: 8,
    ...theme.shadow.card,
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  imageWrap: { alignItems: 'center', marginBottom: 6 },
  image: { width: 140, height: 140, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  imageFallback: {
    width: 140,
    height: 140,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  wordText: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text },
  speakerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcript: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textLight, textAlign: 'center' },
  translation: { fontFamily: theme.fonts.semiBold, fontSize: 17, color: theme.colors.purple, textAlign: 'center', marginTop: 2 },
  exampleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginTop: 14,
    ...theme.shadow.card,
  },
  exampleLabel: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  exampleText: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 22 },
});
