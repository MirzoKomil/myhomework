/**
 * Dars konspektidan qisqa maqsad jumlasini ajratish.
 *
 * Kitobdan keyin `konspekt` maydonida butun konspekt (qoidalar, jadvallar) turadi.
 * "Darsdan keyin: …" kartochkalarida faqat "Bu darsdan keyin siz: …" jumlasi
 * kerak — aks holda butun konspekt bosh sahifaga to'kilib ketadi.
 */
export function lessonGoal(konspekt?: string | null): string {
  const src = (konspekt ?? '').replace(/\r/g, '').trim();
  if (!src) return '';
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  const goal = lines.find((l) => /^Bu darsdan keyin/i.test(l));
  if (goal) return goal.replace(/^Bu darsdan keyin( siz)?\s*:?\s*/i, '').trim();
  // Eski qisqa konspekt (bir qator) — o'zi maqsad.
  if (lines.length === 1) return lines[0];
  // Uzun matn, maqsad jumlasi yo'q — sarlavha qatorlarini tashlab birinchi oddiy qator.
  const first = lines.find((l) => !/^\d+-DARS/i.test(l) && !/^\(.*\)$/.test(l) && !/^-{2,}$/.test(l) && !/^[*•—–-]\s/.test(l));
  return first && first.length <= 160 ? first : '';
}

/**
 * Toshkent vaqti (UTC+5) — o'quvchi kompyuterining soat mintaqasi noto'g'ri
 * bo'lsa ham salomlashish va sana to'g'ri chiqsin. Qaytgan Date'ning
 * getHours/getDate/getDay qiymatlari Toshkent bo'yicha.
 */
export function tashkentNow(d: Date): Date {
  return new Date(d.getTime() + (5 * 60 + d.getTimezoneOffset()) * 60000);
}
