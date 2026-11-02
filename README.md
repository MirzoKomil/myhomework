# Desktop kabinetlar — dizayn zaxirasi (2026-11-02)

Bu branch **kodga tegmaydi** (main'ga merge qilinmaydi). Boshqa Claude akkauntidan ishni davom ettirish uchun.

- `boards/` — ROP (RopK*, RopKL_*) va Sotuv menejeri (SotK*) desktop dizayn bordlari (.dc.html) + `canvas.json` (kanvas joylashuvi). Asl nusxa: claude.ai Design artefakti "Domwork Team — Sotuv ilovasi" (sahifalar "ROP · Kompyuter (B)" va "Sotuv · Kompyuter").
- `tools/` — bordlar manbalari va generatorlar: `pages/` (ROP sahifalari: body.html + js.txt, build.py, mk.sh), `pages/sot/` (sotuv sahifalari), `sot/mk.py` (SotKLeads/Call/Stale), `mkvar.py` (RopKL_* ichki oynalari RopKLeadsC'dan), `support.js` (lokal renderer), `chk.py`.
- `HANDOFF.md` — barcha qarorlar, baholar, topilgan prod xatolar va keyingi qadamlar.

Boshqa akkauntda: claude.ai Projects'dagi "Domwork" loyihasini ochmasdan ham, shu repo + HANDOFF.md yetarli.
