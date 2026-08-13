/** Stable /student/fonts/* paths — no @ in URL (browser-safe for PWA + iframe). */
export const WEB_FONT_BASE = '/student/fonts';

// 56/57/59-vazifa: Plus Jakarta Sans'da kirill (rus) alifbosi glif
// to'plami yo'q edi. Inter'ga (56), keyin Golos Text'ga (57) o'tkazilgan
// edi — lekin Golos Text'ning "regular" (400) og'irligi lotin bilan
// solishtirganda vizual jihatdan sezilarli qalinroq/qorong'iroq chiqib,
// matn "ortiqcha bold" ko'rinardi. Onest — kirill va lotinni bir xil,
// yengil-ochiq uslubda chizadigan shrift, shu sabab u bilan almashtirildi
// (uchta shrift — Golos Text, Onest, Manrope — brauzerda yonma-yon
// solishtirilib tanlandi).
export const webFontFaces = `
@font-face {
  font-family: 'Onest_400Regular';
  src: url('${WEB_FONT_BASE}/onest-400.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Onest_500Medium';
  src: url('${WEB_FONT_BASE}/onest-500.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Onest_600SemiBold';
  src: url('${WEB_FONT_BASE}/onest-600.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Onest_700Bold';
  src: url('${WEB_FONT_BASE}/onest-700.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Onest_800ExtraBold';
  src: url('${WEB_FONT_BASE}/onest-800.ttf') format('truetype');
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
