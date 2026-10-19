/**
 * Kitobdagi konspekt matnini (grammatika mavzusi) tartibli ko'rsatish.
 *
 * Matn formati (darslik chati manbasi, content/ru/LNN.json → CRM description):
 *   "1. Bo'lim nomi"  — bo'lim sarlavhasi
 *   "* …"             — ro'yxat qatori
 *   "— …"             — dialog qatori
 *   "---"             — bo'limlar chegarasi
 *   "Bu darsdan keyin siz: …" — maqsad bloki
 * Qolgan qatorlar — oddiy matn. Ichki formatlash (**qalin**, {koʻk}…) RichText orqali.
 */
import { StyleSheet, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { fonts } from '@/constants/v2/tokens';

import { T } from './shared';

type Block =
  | { k: 'h'; text: string }
  | { k: 'li'; text: string }
  | { k: 'dlg'; text: string }
  | { k: 'goal'; text: string }
  | { k: 'hr' }
  | { k: 'p'; text: string };

function parse(src: string, skipTitle: boolean): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    // Boshidagi "5-DARS: …" va "(ruscha sarlavha)" — ekran sarlavhasida bor.
    if (skipTitle && i < 3 && (/^\d+-DARS/i.test(line) || /^\(.*\)$/.test(line))) return;
    if (/^-{3,}$/.test(line)) return void out.push({ k: 'hr' });
    if (/^Bu darsdan keyin/i.test(line)) return void out.push({ k: 'goal', text: line });
    if (/^\d+\.\s+\S/.test(line) && line.length < 80) return void out.push({ k: 'h', text: line });
    if (/^[*•-]\s+/.test(line)) return void out.push({ k: 'li', text: line.replace(/^[*•-]\s+/, '') });
    if (/^[—–]\s*/.test(line)) return void out.push({ k: 'dlg', text: line });
    out.push({ k: 'p', text: line });
  });
  // Ketma-ket chegaralar va boshidagi/oxiridagi chegaralar olib tashlanadi.
  return out.filter((b, i, a) => !(b.k === 'hr' && (i === 0 || i === a.length - 1 || a[i - 1].k === 'hr')));
}

const txt = { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22, color: '#0B1220', fontWeight: 'normal' as const };

export function Konspekt({ text, skipTitle = true }: { text: string; skipTitle?: boolean }) {
  const blocks = parse(text, skipTitle);
  return (
    <View style={s.card}>
      {blocks.map((b, i) => {
        if (b.k === 'hr') return <View key={i} style={s.hr} />;
        if (b.k === 'h')
          return (
            <T key={i} w={800} size={17} style={{ marginTop: i ? 6 : 0 }}>
              {b.text}
            </T>
          );
        if (b.k === 'goal')
          return (
            <View key={i} style={s.goal}>
              <RichText text={b.text} style={[txt, { color: '#075E3A' }]} />
            </View>
          );
        if (b.k === 'li')
          return (
            <View key={i} style={s.li}>
              <View style={s.dot} />
              <RichText text={b.text} style={[txt, { flex: 1 }]} />
            </View>
          );
        if (b.k === 'dlg') return <RichText key={i} text={b.text} style={[txt, s.dlg]} />;
        return <RichText key={i} text={b.text} style={txt} />;
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  hr: { height: 1, backgroundColor: '#EEF1F7', marginVertical: 4 },
  goal: { backgroundColor: '#E3F7EE', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  li: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingLeft: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2F5BFF', marginTop: 8 },
  dlg: { paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: '#D4DEFF', color: '#26304A' },
});
