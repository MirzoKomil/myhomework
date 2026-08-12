/** Stable /student/fonts/* paths — no @ in URL (browser-safe for PWA + iframe). */
export const WEB_FONT_BASE = '/student/fonts';

// 56/57-vazifa: Plus Jakarta Sans'da kirill (rus) alifbosi glif to'plami
// yo'q edi. Inter'ga o'tkazilgan edi (56-vazifa) — lekin kirill uchun
// vizual jihatdan "quruq"/tekis ko'rinardi. Golos Text — kirill va lotinni
// TENG DARAJADA, bir xil uslubda ("dizaynerlik" nuqtai nazaridan) chizib
// beradigan shrift, shu sabab u bilan almashtirildi.
export const webFontFaces = `
@font-face {
  font-family: 'GolosText_400Regular';
  src: url('${WEB_FONT_BASE}/golos-400.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'GolosText_500Medium';
  src: url('${WEB_FONT_BASE}/golos-500.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'GolosText_600SemiBold';
  src: url('${WEB_FONT_BASE}/golos-600.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'GolosText_700Bold';
  src: url('${WEB_FONT_BASE}/golos-700.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'GolosText_800ExtraBold';
  src: url('${WEB_FONT_BASE}/golos-800.ttf') format('truetype');
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
