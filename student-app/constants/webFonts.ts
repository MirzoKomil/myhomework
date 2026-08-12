/** Stable /student/fonts/* paths — no @ in URL (browser-safe for PWA + iframe). */
export const WEB_FONT_BASE = '/student/fonts';

// 56-vazifa: Plus Jakarta Sans'da kirill (rus) alifbosi glif to'plami yo'q
// edi — Rus tili darslaridagi matnlar brauzerning zaxira (fallback) shrifti
// bilan chizilib, lotin matndan uslub jihatidan farq qilib turardi.
// Inter — lotin va kirillni bab-baravar to'liq qo'llab-quvvatlaydigan
// zamonaviy shrift, shu sabab shu bilan almashtirildi (og'irlik nomlari
// bir xil qolishi uchun @expo-google-fonts/inter'dagi nomlash saqlandi).
export const webFontFaces = `
@font-face {
  font-family: 'Inter_400Regular';
  src: url('${WEB_FONT_BASE}/inter-400.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Inter_500Medium';
  src: url('${WEB_FONT_BASE}/inter-500.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Inter_600SemiBold';
  src: url('${WEB_FONT_BASE}/inter-600.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Inter_700Bold';
  src: url('${WEB_FONT_BASE}/inter-700.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Inter_800ExtraBold';
  src: url('${WEB_FONT_BASE}/inter-800.ttf') format('truetype');
  font-weight: 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'ionicons';
  src: url('${WEB_FONT_BASE}/ionicons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;
