// Ilovaning kirish nuqtasi.
//
// Sinov davrida (Android APK): JavaScript'da kutilmagan xato chiqsa, ilova
// "yopildi" deb yiqilib qolmasin — o'rniga xato matni ekranda ko'rsatiladi,
// shunda skrinshot orqali sababini aniqlash mumkin. Webda hech narsa
// o'zgarmaydi.
const { Platform, Alert } = require('react-native');

if (Platform.OS !== 'web' && global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
  const previous = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  let shown = false;
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      if (!shown) {
        shown = true;
        const message = String((error && error.message) || error);
        const stack = String((error && error.stack) || '').split('\n').slice(0, 8).join('\n');
        Alert.alert(isFatal ? 'Ilovada xatolik' : 'Xatolik', `${message}\n\n${stack}`, [
          { text: 'OK', onPress: () => { shown = false; } },
        ]);
      }
    } catch (e) {
      // ko'rsatib bo'lmasa — odatiy ishlovchiga qoldiramiz
      if (previous) previous(error, isFatal);
      return;
    }
    if (!isFatal && previous) previous(error, isFatal);
  });
}

require('expo-router/entry');
