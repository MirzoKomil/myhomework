import { DemoActivityEntry, sendDemoActivity } from '@/services/contentApi';

// Exam/uyga vazifa/video/lug'at mashqi yakunlanganda haqiqiy natijani
// serverga yuboradi — muvaffaqiyatsiz bo'lsa ham ilova ishlashda davom etadi
// (fire-and-forget), chunki bu faqat ustoz/admin kuzatuvi uchun, o'quvchi
// tajribasiga ta'sir qilmasligi kerak.
export function reportActivity(entry: {
  type: DemoActivityEntry['type'];
  label: string;
  scorePercent?: number;
  passed?: boolean;
  wrongAttempts?: number;
  mistakes?: DemoActivityEntry['mistakes'];
}): void {
  sendDemoActivity(entry).catch(() => {});
}
