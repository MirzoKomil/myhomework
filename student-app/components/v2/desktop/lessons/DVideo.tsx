/**
 * Kompyuter: Videodars (dizayn: D_Video.dc.html).
 *
 * Ma'lumot mobil Videodars ekrani bilan bir xil: video — getLessonMaterials
 * (YouTubeEmbed), "Ko'rdim" → markDone('videoWatch'), konspekt iboralari —
 * speakingPractice, vazifa natijasi — scoreStore, coin — useLessonCoins,
 * grammatika havolasi — loadGrammarRows. Kompyuterda qo'shimcha: mavzu nomi
 * (shu darsga bog'langan grammatika mavzusi) va vazifa qismlari havolalari.
 * Video davomiyligi serverda yo'q — "—". Klaviatura: Space ijro, F to'liq ekran.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { partLabel } from '@/components/v2/homework/lib';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { loadGrammarRows } from '@/components/v2/library/grammar';
import { homeworkSummary } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';
import { markDone, useLessonProgress } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

import { DesktopPage } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { DarkKbd, ICheck, IPlay, T } from './ui';

const go = (h: string) => router.push(h as Href);

export function DVideo({ id }: { id: string }) {
  const [content, setContent] = useState<LessonContent | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [info, setInfo] = useState<{ number: number; name: string; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const progress = useLessonProgress(id);
  const allScores = useHomeworkScores();
  const scores = allScores[id];
  const coins = useLessonCoins(id);
  const [grammar, setGrammar] = useState<{ id: string; title: string } | null>(null);
  const playerRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    loadGrammarRows()
      .then(({ rows }) => {
        const row = rows.find((r) => r.lessons.some((l) => l.lesson.id === id));
        if (!cancelled) setGrammar(row ? { id: row.topic.id, title: row.topic.title } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, name: l?.name ?? `${idx + 1}-dars`, isVideo: idx % 2 === 0 });
        setVideoUrl(getLessonMaterials(mc, id).videoUrl);
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    saveLastPosition({ lessonId: id, section: 'video/watch', label: 'Video dars' });
  }, [id]);

  const watched = progress.videoWatch;
  const title = info ? `${info.number}-dars · Videodars` : 'Videodars';
  const subtitle = watched ? 'Koʻrilgan · qayta koʻrish' : videoUrl ? 'Koʻrilmagan' : 'Video hali biriktirilmagan';

  const onPrimary = async () => {
    if (!videoUrl) return;
    if (!watched) {
      await markDone(id, 'videoWatch');
      return;
    }
    setPlaying(true);
  };
  // F — videoni ijro etib, pleer blokini brauzerning to'liq ekraniga chiqaradi.
  const fullscreen = () => {
    if (!videoUrl) return;
    setPlaying(true);
    if (Platform.OS === 'web') {
      const el = playerRef.current as unknown as HTMLElement | null;
      el?.requestFullscreen?.().catch(() => {});
    }
  };
  useDesktopKeys({ ' ': () => videoUrl && setPlaying(true), f: fullscreen });

  if (!content || !info) {
    return (
      <DesktopPage title={title} back={R.path}>
        <T f="body" size={14} color="#4A5468">
          {error ? 'Darsni yuklab boʻlmadi.' : 'Yuklanmoqda…'}
        </T>
      </DesktopPage>
    );
  }

  const chips = content.vocabulary.slice(0, 3).map((w) => w.english);
  const parts = Object.values(scores ?? {});
  const correct = parts.reduce((a, p) => a + p.correct, 0);
  const total = parts.reduce((a, p) => a + p.total, 0);
  const meta = [
    grammar?.title ?? '',
    content.vocabulary.length ? `${content.vocabulary.length} ta soʻz` : '',
    total ? `vazifa ${correct} / ${total}` : '',
    total || coins ? `+${coins} coin` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const phrases = content.speakingPractice;
  const hwParts = content.homeworkParts.filter((p) => p.kind !== 'creative');
  const hw = homeworkSummary({ id, content }, allScores[id]);
  const hwStatus = hw.done ? 'Topshirilgan · takrorlash mumkin' : hw.answered > 0 ? 'Davom etmoqda' : 'Avtomatik tekshiriladi';

  return (
    <DesktopPage title={title} subtitle={subtitle} back={R.path}>
      <View style={s.body}>
        <View style={s.main}>
          <View ref={playerRef} accessibilityLabel="Videopleer" style={s.player}>
            {playing && videoUrl ? (
              <YouTubeEmbed url={videoUrl} />
            ) : (
              <>
                <View accessibilityElementsHidden style={s.blob} />
                <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={s.mascot} resizeMode="contain" accessibilityLabel="Doskada dars oʻtayotgan Domik" />
                {watched && (
                  <View style={s.seen}>
                    <ICheck size={17} color="#087A4A" />
                    <T size={15} color="#075E3A">
                      Koʻrilgan
                    </T>
                  </View>
                )}
                {chips.length > 0 && (
                  <View accessibilityElementsHidden style={s.chips}>
                    {chips.map((c, k) => {
                      const dark = k === chips.length - 1 && chips.length > 1;
                      return (
                        <View key={k} style={[s.chip, dark && { backgroundColor: '#0B1220' }]}>
                          <T size={20} color={dark ? '#FFFFFF' : '#0B1220'}>
                            {c}
                          </T>
                        </View>
                      );
                    })}
                  </View>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={watched ? 'Qayta koʻrish (Space)' : 'Videoni ijro etish (Space)'} disabled={!videoUrl} onPress={() => setPlaying(true)} style={[s.play, !videoUrl && { opacity: 0.5 }]}>
                  <View style={{ marginLeft: 6 }}>
                    <IPlay size={40} color="#FFFFFF" />
                  </View>
                </Pressable>
                <View style={s.bar}>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: watched ? 0.95 : 0.35 }} />
                  <View style={s.time}>
                    <T size={14} color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
                      —
                    </T>
                  </View>
                  <DarkKbd>Space</DarkKbd>
                  <T f="bodyBold" size={13} color="#FFFFFF" style={{ marginLeft: -6 }}>
                    ijro
                  </T>
                  <DarkKbd>F</DarkKbd>
                  <T f="bodyBold" size={13} color="#FFFFFF" style={{ marginLeft: -6 }}>
                    toʻliq ekran
                  </T>
                </View>
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <View style={{ flexGrow: 1, flexBasis: 280, minWidth: 0, gap: 6 }}>
              <T size={25} lh={30}>
                {info.name}
              </T>
              {!!meta && (
                <T f="bodyBold" size={15} color="#4A5468">
                  {meta}
                </T>
              )}
            </View>
            <Pressable accessibilityRole="link" onPress={() => go(grammar ? R.grammar(grammar.id) : R.grammarList)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
              <T size={16}>Grammatika</T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={watched ? 'Videoni qayta koʻrish' : undefined}
              disabled={!videoUrl}
              onPress={onPrimary}
              style={({ pressed }) => [s.primary, !videoUrl && { opacity: 0.5 }, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              {watched ? <IPlay size={18} color="#FFFFFF" /> : <ICheck size={18} />}
              <T size={16} color="#FFFFFF">
                {watched ? 'Qayta koʻrish' : 'Koʻrdim'}
              </T>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Stat label="Davomiyligi" value="—" note={watched ? 'toʻliq koʻrilgan' : 'koʻrilmagan'} />
            <Stat label="Mavzu" value={grammar?.title ?? '—'} note={content.vocabulary.length ? `${content.vocabulary.length} ta soʻz` : ''} />
            <Stat label="Vazifa" value={total ? `${correct} / ${total} toʻgʻri` : `${hw.answered} / ${hw.total}`} note={`+${coins} coin`} green />
          </View>
        </View>

        <View accessibilityLabel="Videodars materiallari" style={s.aside}>
          <View accessibilityLabel="Konspekt" style={s.konspekt}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4, paddingBottom: 6 }}>
              <T size={17}>Konspekt · asosiy iboralar</T>
              {phrases.length > 0 && (
                <T size={14} color="#1E3FD1">
                  {phrases.length} ta
                </T>
              )}
            </View>
            {phrases.length > 0 ? (
              phrases.map((p, k) => (
                <View key={p.id} style={[s.kRow, k > 0 && { borderTopWidth: 1, borderTopColor: '#EEF1F7' }]}>
                  <RichText style={s.kRu} text={p.sentence} />
                  <RichText style={s.kUz} text={p.translation} />
                </View>
              ))
            ) : (
              <View style={s.kRow}>
                <RichText style={s.kUz} text={content.konspekt} />
              </View>
            )}
          </View>
          {hwParts.length > 0 && (
            <View accessibilityLabel={`${info.number}-dars vazifasi`} style={s.hw}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} style={{ width: 48, height: 48 }} resizeMode="contain" />
                <View style={{ gap: 1, flex: 1 }}>
                  <T size={15} color="#075E3A">
                    {info.number}-dars vazifasi · {total ? `${correct} / ${total}` : `${hw.answered} / ${hw.total}`}
                  </T>
                  <T f="bodyBold" size={13} color="#075E3A">
                    {hwStatus}
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {hwParts.map((p) => (
                  <Pressable key={p.id} accessibilityRole="link" onPress={() => go(R.homeworkPart(id, p.id))} style={({ pressed }) => [s.part, pressed && { opacity: 0.85 }]}>
                    <T size={14} color="#075E3A" lines={1}>
                      {partLabel(p, true)}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </DesktopPage>
  );
}

function Stat({ label, value, note, green }: { label: string; value: string; note: string; green?: boolean }) {
  return (
    <View style={[s.stat, green && { backgroundColor: '#E3F7EE' }]}>
      <T f="bodyBold" size={13} color="#4A5468">
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T size={20} color={green ? '#075E3A' : '#0B1220'} lines={1} style={{ flexShrink: 1 }}>
          {value}
        </T>
        {!!note && (
          <T f="bodyBold" size={13} color="#4A5468" lines={1}>
            {note}
          </T>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
  main: { flex: 1, minWidth: 0, gap: 18 },
  // Past oynada pleer 300px dan kichraymaydi — sahifa o'zi aylanadi.
  player: { position: 'relative', flex: 1, minHeight: 300, borderRadius: 28, overflow: 'hidden', backgroundColor: '#FFC93C' },
  blob: { position: 'absolute', right: -60, top: -80, width: 420, height: 420, borderRadius: 210, backgroundColor: '#FFD866' },
  mascot: { position: 'absolute', left: 40, bottom: 10, width: 470, height: 437, maxHeight: '90%' },
  seen: { position: 'absolute', left: 22, top: 22, height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 },
  chips: { position: 'absolute', right: 30, top: 90, alignItems: 'flex-end', gap: 10 },
  chip: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 14 },
  play: { position: 'absolute', left: '50%', top: '50%', marginLeft: -48, marginTop: -48, width: 96, height: 96, borderRadius: 48, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundImage: 'linear-gradient(180deg, rgba(11,18,32,0) 0%, rgba(11,18,32,0.72) 100%)',
  } as object,
  time: { height: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#0B1220', justifyContent: 'center' },
  second: { height: 52, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', alignItems: 'center', justifyContent: 'center' },
  primary: { height: 52, paddingLeft: 18, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
  // Tor oynada kartalar keyingi qatorga o'tadi (1440 da bitta qator, 84px).
  stat: { flexGrow: 1, flexBasis: 150, minWidth: 0, height: 84, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 18, justifyContent: 'center', gap: 1 },
  aside: { width: 340, flexShrink: 0, gap: 16 },
  konspekt: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 10, justifyContent: 'space-between' },
  kRow: { flex: 1, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 3 },
  kRu: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: '#0B1220', fontWeight: 'normal' },
  kUz: { fontFamily: fonts.body, fontSize: 15, color: '#4A5468', fontWeight: 'normal' },
  hw: { backgroundColor: '#E3F7EE', borderRadius: 24, padding: 16, justifyContent: 'center', gap: 12 },
  part: { flex: 1, minWidth: 0, height: 46, paddingHorizontal: 6, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
