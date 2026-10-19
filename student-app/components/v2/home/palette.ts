/**
 * Bosh sahifa ranglari: yorug' (Main.dc.html) va qorong'u (DarkMain.dc.html).
 * Qorong'u palitra faqat shu guruhga tegishli — umumiy tokens.ts'ga
 * qo'shilmadi, chunki boshqa ekranlarning qorong'u dizayni hali yo'q.
 */
export type HomePalette = {
  bg: string;
  text: string;
  muted: string;
  avatarBg: string;
  pillBg: string;
  coinText: string;
  streakText: string;
  bellStroke: string;
  badgeBorder: string;
  chipBg: string;
  chipText: string;
  continueBg: string;
  continueText: string;
  liveBg: string;
  telegramText: string;
  card: string;
  shieldLabel: string;
  dayLabel: string;
  emptyDay: string;
  todayBg: string;
  todayLabel: string;
  vocabIconBg: string;
  battleIconBg: string;
  navBg: string;
  navBorder: string;
  navActive: string;
  navInactive: string;
};

export const lightHome: HomePalette = {
  bg: '#F4F6FA',
  text: '#0B1220',
  muted: '#4A5468',
  avatarBg: '#FFF1E6',
  pillBg: '#FFFFFF',
  coinText: '#7A5300',
  streakText: '#B34700',
  bellStroke: '#0B1220',
  badgeBorder: '#F4F6FA',
  chipBg: '#FFFFFF',
  chipText: '#1E3FD1',
  continueBg: '#FFFFFF',
  continueText: '#0B1220',
  liveBg: '#0B1220',
  telegramText: '#0B1220',
  card: '#FFFFFF',
  shieldLabel: '#1E3FD1',
  dayLabel: '#4A5468',
  // Dizaynda bo'sh (hali bajarilmagan) kun ko'rinishi yo'q — halqa izi rangi olindi.
  emptyDay: '#EEF1F7',
  todayBg: '#FFFFFF',
  todayLabel: '#0B1220',
  vocabIconBg: '#F0EBFF',
  battleIconBg: '#FFF1E6',
  navBg: '#FFFFFF',
  navBorder: '#E4E8F0',
  navActive: '#2F5BFF',
  navInactive: '#5B6478',
};

export const darkHome: HomePalette = {
  bg: '#0B1220',
  text: '#F2F4F8',
  muted: '#AEB6C8',
  avatarBg: '#3A2414',
  pillBg: '#161E31',
  coinText: '#FFD66B',
  streakText: '#B34700',
  bellStroke: '#F2F4F8',
  badgeBorder: '#0B1220',
  chipBg: '#161E31',
  chipText: '#8FA8FF',
  continueBg: '#161E31',
  continueText: '#F2F4F8',
  liveBg: '#1B2438',
  telegramText: '#F2F4F8',
  card: '#161E31',
  shieldLabel: '#8FA8FF',
  dayLabel: '#AEB6C8',
  emptyDay: '#24304A',
  todayBg: '#161E31',
  todayLabel: '#F2F4F8',
  vocabIconBg: '#2A2350',
  battleIconBg: '#3A2414',
  navBg: '#161E31',
  navBorder: '#24304A',
  navActive: '#8FA8FF',
  navInactive: '#9AA4BC',
};
