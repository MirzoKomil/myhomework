import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

import { theme } from '@/constants/theme';
import { DESKTOP_BREAKPOINT, WEB_APP_MAX_WIDTH } from '@/constants/web';
import { webFontFaces } from '@/constants/webFonts';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={theme.colors.purple} />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Myhomework" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Myhomework" />
        <meta name="description" content="O'quv markaz o'quvchilari uchun mobil veb ilova" />
        <link rel="manifest" href="/student/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/student/assets/images/icon.png" />
        <link rel="preload" href="/student/fonts/plus-jakarta-400.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/student/fonts/ionicons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: webFontFaces }} />
        <style dangerouslySetInnerHTML={{ __html: mobileAppStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const mobileAppStyles = `
html {
  height: 100%;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100%;
  min-height: 100dvh;
  background: linear-gradient(160deg, #dfe4f0 0%, #c8d0e4 100%);
  color: ${theme.colors.text};
  font-family: 'PlusJakartaSans_400Regular', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
}

#root,
body > div:first-child {
  width: 100%;
  min-height: 100dvh;
  background: ${theme.colors.bg};
  position: relative;
  overflow-x: hidden;
}

/* Kompyuter kengligida (${DESKTOP_BREAKPOINT}px+) ilova telefon maketi
   sifatida emas, to'liq kengaygan desktop ilova sifatida ochiladi —
   ichki sidebar/kontent kengligini (tabs)/_layout.tsx o'zi boshqaradi. */
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  #root,
  body > div:first-child {
    max-width: none;
  }
}

@media (max-width: ${DESKTOP_BREAKPOINT - 1}px) {
  #root,
  body > div:first-child {
    max-width: ${WEB_APP_MAX_WIDTH}px;
    margin: 0 auto;
    box-shadow: 0 16px 64px rgba(26, 29, 46, 0.14);
  }
}

@media (max-width: ${WEB_APP_MAX_WIDTH}px) {
  body {
    background: ${theme.colors.bg};
  }

  #root,
  body > div:first-child {
    box-shadow: none;
  }
}

* {
  -webkit-tap-highlight-color: transparent;
}

input,
textarea,
button,
select {
  font-family: 'PlusJakartaSans_400Regular', system-ui, sans-serif;
}

/* Ionicons — vector icon glyphs */
.r-lrvibr,
[style*="font-family: ionicons"],
[style*="font-family:ionicons"] {
  font-family: 'ionicons' !important;
  font-weight: normal !important;
  font-style: normal !important;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}
`;
