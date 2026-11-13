# Imtihon v2 savollar banki (rus tili)

- `interval-1..6.json`, `final.json` — 5 bo'lim (Lug'at 8, Grammatika 14, O'qish 8, Gap tuzish 10, Tinglash 6; yakuniy 10/18/12/11/9), har slotga 3 parallel variant.
- Manba: jonli darslik (`/api/state/mobile-content?course=russian`) — dars lug'ati (rasmlar), uyga vazifa va oldingi imtihon savollari, o'qish matnlari, audio dialoglar (`audio/*` branch mp3, `playUntil` — takrorlash qismigacha).
- Har savolda `lessonRef` (dars raqami). Savollarda faqat shu darsgacha o'rganilgan so'zlar ishlatilgan (tekshiruv skripti).
- Mustaqil metodist tekshiruvi: 138 tuzatish (urg'u, tinish belgisi, qo'shimcha to'g'ri tartiblar `accepted`), 11 savol olib tashlandi.
- Ilovaga yuklash: CRM `mobile_content.examContents["<id>-russian"].bankV2` (eski `questions` tegilmaydi).
- `_build.py` — yig'uvchi skript (qayta yig'ilsa, tekshiruv tuzatishlarini qayta qo'llash kerak).
