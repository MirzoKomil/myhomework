# content/ru — rus tili kursi, kitobning oxirgi holati (manba)

Bu papka **faqat manba**. CRM'ga hech narsa yozilmagan — platforma chati shu fayllar bilan CRM'ni solishtirib, farqlarni ko'rsatib, keyin yangilaydi.
Kitob versiyasi: `book_version.txt`. Rasmlar: `media/ru-l01-l72` branch (`media/ru/LNN/…`, `media/ru/map.json`).

## LNN.json (01..72)
| Maydon | Ma'nosi |
|---|---|
| `n` | dars raqami |
| `lessonId` | CRM id: 1-dars `l1783004411232`, N-dars `l1784055280406-(N-1)` |
| `type` | `video` (videodars, toq) / `live` (jonli dars, juft) |
| `topic` | mavzu (o'zbekcha), `title` — dars nomi (ruscha, urg'u bilan), `title_ru` — video darslarda qo'shimcha ruscha sarlavha |
| `cando` | dars maqsadi («Bu darsdan keyin…») |
| `videoUrl` | video havolasi (bo'sh bo'lsa — «video o'rniga konspekt va slaydlar») |
| `review` | videodars boshidagi «O'tgan darsni eslaymiz» savollari `[{q}]` |
| `vocab[]` | `ru` (urg'u bilan), `tr` (transkripsiya), `uz` (tarjima), `ex` (misol gap), `img` (kitobdagi rasm), `vocabId` (CRM `v-N-i`), `media` (repo'dagi rasm) |
| `konspekt` | konspekt matni (`*` — ro'yxat, `---` — bo'lim chegarasi) |
| `text` | o'qish matni: `title`, `ru`, `uz`, `questions[{q, opts[], a}]` (`a` — to'g'ri variant indeksi, 0 dan) |
| `dialog` | (ba'zi darslarda) `{lines:[{who, ru, uz}]}` |
| `exercises.matching` | `[[ruscha, o'zbekcha], …]` |
| `exercises.fillBlank` | `[{s: gap ___ bilan, o: variantlar, a: to'g'ri javob matni}]` |
| `exercises.multipleChoice` | `[{q, o: variantlar, a: indeks}]` |
| `exercises.sentenceBuild` | `[{w: so'zlar, a: to'g'ri gap, t: tarjima}]` |
| `speaking` | gapirish iboralari `[{ru, uz}]` (kitob «Gapiring» bloki) |

Urg'u: unlidan keyin U+0301 (`а́`). Platformada ko'rsatishda kerak bo'lmasa — `.replace(/\u0301/g, '')`.
Olib tashlangan: `creative` (ijodiy vazifa — platformadan olingan), `plan` va `slides` (ustoz rejasi va slayd matni; slayd rasmlari media branch'da).

Platformaga o'tkazilganda (avvalgi qoida): o'qish → `reading`; matn savollari «Matn bo'yicha: …» qilib `multipleChoice` ga qo'shiladi; matching/fillBlank/multipleChoice/sentenceBuild → shu nomli `homeworkParts`.

## exams/
`interval-1..6.json` (40 savol), `final.json` (50 savol): `{title_uz, passPercent: 70, questions:[{kind, id, question|sentence|words, options, correctIndex|answer}]}` — CRM `examContents['interval-N-russian' | 'final-russian']` bilan bir xil format. `oral.json` — og'zaki qism (ustoz uchun, platformaga emas).

## Kitobda yo'q, platformada bor — **platformadan olib tashlansin**
1. **«TAKRORLASH — …-darslar so'zlari»** (`kind: matching`, id `review-N`) — har 6-darsda: 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72-darslar. Kitobda bunday mashq yo'q (avtomatik yig'ilgan edi).
2. **Ijodiy vazifa** (`kind: creative`) — agar biror darsda qolgan bo'lsa.
3. **`speakingPractice`** va **`grammarBlanks`** — kitobda platforma mashqi sifatida yo'q (hozir CRM'da hammasi bo'sh — tekshirib, bo'sh qoldirilsin).
CRM bilan 2026-10-20 da solishtirildi: 72 dars, 874 so'z (id lar mos), 788 slayd; 2-darsda kitobdan tashqari qo'shimcha qism topilmadi (o'qish, moslash, bo'sh joy, test, gap tuzish — kitob bilan bir xil).
