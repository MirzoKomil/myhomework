import { Image } from 'react-native';

// 146-ish: qulflangan ekran / boshqaruv markazidagi "Endi ijro etilmoqda"
// vidjeti uchun umumiy metama'lumotlar — radio va podkast pleyerlarida
// ishlatiladi. Rasm doim Homework logotipi (har bir stansiya/epizodning
// o'z rasmi emas) — brend izchilligi uchun ataylab shunday.
//
// Funksiya sifatida eksport qilingan — chaqirilmaguncha ishlamaydi, chunki
// `Image.resolveAssetSource` statik eksport paytidagi Node/SSR muhitida
// mavjud emas (faqat brauzer/native runtime'da ishlaydi).
export function getHomeworkArtworkUri(): string {
  return Image.resolveAssetSource(require('@/assets/images/icon.png')).uri;
}
export const HOMEWORK_SCHOOL_NAME = 'Homework onlayn maktabi';
