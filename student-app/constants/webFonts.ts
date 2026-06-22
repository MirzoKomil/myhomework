/** Stable /student/fonts/* paths — no @ in URL (browser-safe for PWA + iframe). */
export const WEB_FONT_BASE = '/student/fonts';

export const webFontFaces = `
@font-face {
  font-family: 'PlusJakartaSans_400Regular';
  src: url('${WEB_FONT_BASE}/plus-jakarta-400.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'PlusJakartaSans_500Medium';
  src: url('${WEB_FONT_BASE}/plus-jakarta-500.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'PlusJakartaSans_600SemiBold';
  src: url('${WEB_FONT_BASE}/plus-jakarta-600.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'PlusJakartaSans_700Bold';
  src: url('${WEB_FONT_BASE}/plus-jakarta-700.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'PlusJakartaSans_800ExtraBold';
  src: url('${WEB_FONT_BASE}/plus-jakarta-800.ttf') format('truetype');
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
