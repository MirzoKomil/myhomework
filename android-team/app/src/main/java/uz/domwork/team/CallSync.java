package uz.domwork.team;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.CallLog;
import android.provider.MediaStore;
import android.widget.Toast;

import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Qo'ng'iroq yozuvini CRM'ga avtomatik yuklash.
 * Android 10+ ilovalarga qo'ng'iroqni o'zi yozishni taqiqlagan, shuning uchun yozuvni TELEFONNING O'Z
 * yozuvchisi qiladi ("Avtomatik yozish → Barcha qo'ng'iroqlar"). Ilova faqat:
 *  1) CRM'dan tel: bosilganda raqam, lid va vaqtni eslab qoladi;
 *  2) ilovaga qaytilganda shu vaqtdan keyin paydo bo'lgan audio faylni MediaStore'dan topadi
 *     (fayl nomidagi raqam yoki "call/record/запис" papkasi bo'yicha — telefon modeliga bog'liq emas);
 *  3) uni /api/call-ai/upload ga yuboradi → server lidga biriktiradi va AI tahlilga qo'yadi.
 * Topilmasa — /api/call-ai/missing (menejerga "yozuv topilmadi" ogohlantirishi).
 */
final class CallSync {
    static final int AUDIO_REQUEST = 45;
    private static final String P = "callsync";
    private static final long LEAD_HINT_MS = 15_000;      // sahifadan lid kelgan bo'lsa, shu vaqt ichidagi tel: unga tegishli
    private static final long MAX_AGE_MS = 3 * 3600_000L; // 3 soatdan eski qo'ng'iroq izlanmaydi
    private static final long[] SCAN_DELAYS = {1500, 5000, 12000, 25000, 60000};
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static boolean scanning = false;

    private CallSync() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }

    static String audioPermission() {
        return Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    /** Yozuv + qo'ng'iroqlar jurnali (javob berilmagan qo'ng'iroqni "yozuv topilmadi" deb ko'rsatmaslik uchun). */
    static String[] permissions() { return new String[]{audioPermission(), Manifest.permission.READ_CALL_LOG}; }

    static boolean callLogGranted(Context c) {
        return Build.VERSION.SDK_INT < 23 || c.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED;
    }

    /** Jurnaldagi shu raqamga qilingan qo'ng'iroq davomiyligi (soniya); jurnal yo'q/topilmasa -1. */
    static long callDuration(Context c, Pending pc) {
        if (!callLogGranted(c) || pc.startAt == 0) return -1;
        String tail = digits(pc.phone);
        if (tail.length() > 7) tail = tail.substring(tail.length() - 7);
        if (tail.length() < 7) return -1;
        try (Cursor cur = c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                new String[]{CallLog.Calls.NUMBER, CallLog.Calls.DURATION},
                CallLog.Calls.DATE + " >= ? AND " + CallLog.Calls.DATE + " <= ?",
                new String[]{String.valueOf(pc.startAt - 10_000), String.valueOf(pc.startAt + MAX_AGE_MS)},
                CallLog.Calls.DATE + " ASC")) {
            if (cur == null) return -1;
            while (cur.moveToNext()) if (digits(cur.getString(0)).endsWith(tail)) return cur.getLong(1);
        } catch (Exception ignored) { /* ruxsat olib tashlangan */ }
        return -1;
    }

    static boolean audioGranted(Context c) {
        return Build.VERSION.SDK_INT < 23 || c.checkSelfPermission(audioPermission()) == PackageManager.PERMISSION_GRANTED;
    }

    /** Sahifa (sotuv ilovasi) qo'ng'iroq tugmasi bosilganda: qaysi lid. */
    static void leadHint(Context c, String leadId, String lang) {
        prefs(c).edit().putString("hintLead", leadId == null ? "" : leadId).putString("hintLang", lang == null ? "" : lang)
                .putLong("hintAt", System.currentTimeMillis()).apply();
    }

    /** tel: ochilishidan oldin: qo'ng'iroqni eslab qolish. Oldingisi topilmagan bo'lsa — "topilmadi" deb yuboriladi. */
    static void onDial(Activity a, String phone) {
        SharedPreferences p = prefs(a);
        long now = System.currentTimeMillis();
        if (p.getLong("startAt", 0) > 0 && now - p.getLong("startAt", 0) > 60_000) {
            Pending prev = snapshot(p);
            long d = callDuration(a, prev);
            if (d < 0 || d >= 30) reportMissing(a, prev, "keyingi qoʻngʻiroq boshlandi", d); // javobsiz/qisqa — yozuv kutilmaydi
        }
        boolean hintFresh = now - p.getLong("hintAt", 0) < LEAD_HINT_MS;
        p.edit().putString("phone", phone == null ? "" : phone)
                .putString("leadId", hintFresh ? p.getString("hintLead", "") : "")
                .putString("lang", hintFresh ? p.getString("hintLang", "") : "")
                .putLong("startAt", now).putLong("hintAt", 0).apply();
    }

    /** Ilovaga qaytilganda (onResume): kutilayotgan qo'ng'iroq bo'lsa, yozuvni bir necha marta izlaydi. */
    static void onResume(Activity a, TokenSource tokens) {
        SharedPreferences p = prefs(a);
        long start = p.getLong("startAt", 0);
        if (start == 0 || scanning) return;
        long age = System.currentTimeMillis() - start;
        if (age < 4000) return; // dialer hali ochilmagan
        if (age > MAX_AGE_MS) { Pending old = snapshot(p); long d = callDuration(a, old); if (d < 0 || d >= 30) reportMissing(a, old, "3 soatdan oshdi", d); clear(p); return; }
        if (!audioGranted(a)) { set(a, "Yozuvlarni oʻqishga ruxsat yoʻq"); return; }
        scanning = true;
        tokens.get(token -> {
            if (token != null && !token.isEmpty()) prefs(a).edit().putString("token", token).apply();
            scheduleScan(a, 0);
        });
    }

    interface TokenSource { void get(TokenCallback cb); }
    interface TokenCallback { void done(String token); }

    private static void scheduleScan(Activity a, int attempt) {
        if (attempt >= SCAN_DELAYS.length) {
            // Topilmadi: jurnal bo'yicha javob berilmagan yoki 30 soniyadan qisqa bo'lsa — kutish shart emas.
            Pending pc = snapshot(prefs(a));
            long d = callDuration(a, pc);
            if (d >= 0 && d < 30) clearIf(prefs(a), pc.startAt);
            // Gaplashilgan (30+ son) qo'ng'iroqning yozuvi topilmadi — darhol xabar beriladi (keyingi qo'ng'iroqda qayta yuborilmaydi).
            else if (d >= 30) { reportMissing(a, pc, "yozuv topilmadi", d); clearIf(prefs(a), pc.startAt); }
            scanning = false;
            return;
        }
        main.postDelayed(() -> new Thread(() -> {
            Pending pc = snapshot(prefs(a));
            if (pc.startAt == 0) { scanning = false; return; }
            Found f = find(a.getApplicationContext(), pc);
            if (f == null) { scheduleScan(a, attempt + 1); return; }
            String err = upload(a.getApplicationContext(), pc, f);
            if (err == null) {
                clearIf(prefs(a), pc.startAt);
                set(a, "Yuklandi: " + f.name);
                main.post(() -> Toast.makeText(a, "Qoʻngʻiroq yozuvi CRM'ga yuklandi — AI tahlil qilmoqda", Toast.LENGTH_LONG).show());
                scanning = false;
            } else if (err.equals("server 401")) {
                set(a, "Qayta kiring — sessiya tugagan"); // token yangilangach keyingi qaytishda yana uriniladi
                scanning = false;
            } else if (err.startsWith("server 4")) {
                // Doimiy xato (fayl turi/hajmi): qayta-qayta yubormaymiz.
                set(a, "Yuklanmadi: " + err);
                reportMissing(a, pc, "yuklanmadi: " + err, callDuration(a, pc));
                clearIf(prefs(a), pc.startAt);
                scanning = false;
            } else {
                set(a, "Yuklanmadi: " + err);
                scheduleScan(a, attempt + 1);
            }
        }).start(), SCAN_DELAYS[attempt]);
    }

    static final class Pending { String phone, leadId, lang; long startAt; }
    static final class Found { Uri uri; String name, mime; long durationMs, size; }

    private static Pending snapshot(SharedPreferences p) {
        Pending x = new Pending();
        x.phone = p.getString("phone", ""); x.leadId = p.getString("leadId", ""); x.lang = p.getString("lang", "");
        x.startAt = p.getLong("startAt", 0);
        return x;
    }

    /** Yuklash davomida yangi qo'ng'iroq boshlangan bo'lsa, uni o'chirib yubormaslik. */
    private static void clearIf(SharedPreferences p, long startAt) {
        if (p.getLong("startAt", 0) == startAt) clear(p);
    }

    private static void clear(SharedPreferences p) {
        p.edit().remove("phone").remove("leadId").remove("lang").remove("startAt").apply();
    }

    private static void set(Context c, String status) {
        prefs(c).edit().putString("last", new SimpleDateFormat("HH:mm", Locale.US).format(new Date()) + " · " + status).apply();
    }

    static String lastStatus(Context c) { return prefs(c).getString("last", ""); }

    private static String digits(String s) { return s == null ? "" : s.replaceAll("\\D", ""); }

    /** Qo'ng'iroq boshlangandan keyin qo'shilgan audio fayllardan eng mosini tanlaydi. */
    static Found find(Context c, Pending pc) {
        ContentResolver cr = c.getContentResolver();
        Uri base = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String pathCol = Build.VERSION.SDK_INT >= 29 ? MediaStore.Audio.Media.RELATIVE_PATH : MediaStore.Audio.Media.DATA;
        String[] proj = {MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.MIME_TYPE, pathCol};
        String sel = MediaStore.Audio.Media.DATE_ADDED + " >= ?";
        String[] args = {String.valueOf(pc.startAt / 1000 - 15)};
        String tail = digits(pc.phone);
        tail = tail.length() > 7 ? tail.substring(tail.length() - 7) : tail;
        Found best = null;
        int bestRank = 0;
        try (Cursor cur = cr.query(base, proj, sel, args, MediaStore.Audio.Media.DATE_ADDED + " DESC")) {
            if (cur == null) return null;
            while (cur.moveToNext()) {
                String name = cur.getString(1) == null ? "" : cur.getString(1);
                long dur = cur.getLong(3), size = cur.getLong(4);
                String path = (cur.getString(6) == null ? "" : cur.getString(6)).toLowerCase(Locale.ROOT);
                String low = name.toLowerCase(Locale.ROOT);
                if (size < 2000) continue;
                if (path.contains("telegram") || path.contains("whatsapp") || path.contains("ringtone") || path.contains("notification")
                        || path.contains("alarm") || path.contains("podcast") || path.contains("voice recorder") || path.contains("voice_recorder")) continue;
                // Yozuv qo'ng'iroq TUGAGANDAN keyin paydo bo'ladi: (boshlanish + davomiylik − 2 daq) dan oldingisi boshqa fayl.
                long added = cur.getLong(2) * 1000L;
                if (dur > 0 && added < pc.startAt + dur - 120_000L) continue;
                int rank = 0;
                if (tail.length() >= 7 && digits(name).contains(tail)) rank = 3;
                else if (path.contains("call") || path.contains("запис") || path.contains("вызов")
                        || low.contains("call") || low.contains("запис") || low.contains("вызов")) rank = 2;
                if (rank > bestRank) {
                    bestRank = rank;
                    best = new Found();
                    best.uri = ContentUris.withAppendedId(base, cur.getLong(0));
                    best.name = name; best.durationMs = dur; best.size = size;
                    best.mime = cur.getString(5) == null ? "audio/mpeg" : cur.getString(5);
                }
            }
        } catch (Exception ignored) {
            return null;
        }
        return best;
    }

    private static String iso(long ms) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ms));
    }

    /** null — muvaffaqiyat, aks holda xato matni. */
    static String upload(Context c, Pending pc, Found f) {
        String token = prefs(c).getString("token", "");
        if (token.isEmpty()) return "kirish (token) yoʻq";
        String boundary = "----dw" + UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL("https://" + MainActivity.HOST + "/api/call-ai/upload").openConnection();
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setConnectTimeout(20000);
            con.setReadTimeout(120000);
            con.setChunkedStreamingMode(64 * 1024);
            con.setRequestProperty("Authorization", "Bearer " + token);
            con.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            try (OutputStream raw = con.getOutputStream(); DataOutputStream out = new DataOutputStream(raw)) {
                field(out, boundary, "phone", pc.phone);
                field(out, boundary, "leadId", pc.leadId);
                field(out, boundary, "lang", pc.lang);
                field(out, boundary, "startedAt", iso(pc.startAt));
                long sec = Math.round(f.durationMs / 1000.0);
                if (sec <= 0) sec = Math.max(0, callDuration(c, pc));
                field(out, boundary, "durationSec", String.valueOf(sec));
                out.writeBytes("--" + boundary + "\r\n");
                out.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + f.name.replace("\"", "") .replaceAll("[^\\x20-\\x7E]", "_") + "\"\r\n");
                out.writeBytes("Content-Type: " + f.mime + "\r\n\r\n");
                try (InputStream in = c.getContentResolver().openInputStream(f.uri)) {
                    if (in == null) return "fayl ochilmadi";
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                out.writeBytes("\r\n--" + boundary + "--\r\n");
            }
            int code = con.getResponseCode();
            return code >= 200 && code < 300 ? null : "server " + code;
        } catch (Exception e) {
            return e.getClass().getSimpleName();
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static void field(DataOutputStream out, String b, String name, String value) throws java.io.IOException {
        out.writeBytes("--" + b + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
        out.write((value == null ? "" : value).getBytes("UTF-8"));
        out.writeBytes("\r\n");
    }

    private static void reportMissing(Context c, Pending pc, String reason, long durationSec) {
        String token = prefs(c).getString("token", "");
        if (token.isEmpty() || pc.startAt == 0) return;
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL("https://" + MainActivity.HOST + "/api/call-ai/missing").openConnection();
                con.setRequestMethod("POST");
                con.setDoOutput(true);
                con.setConnectTimeout(15000);
                con.setRequestProperty("Authorization", "Bearer " + token);
                con.setRequestProperty("Content-Type", "application/json");
                String body = "{\"phone\":\"" + digits(pc.phone) + "\",\"leadId\":\"" + pc.leadId.replace("\"", "") + "\",\"startedAt\":\"" + iso(pc.startAt)
                        + "\",\"reason\":\"" + reason.replace("\"", "") + "\",\"durationSec\":" + Math.max(0, durationSec) + "}";
                try (OutputStream o = con.getOutputStream()) { o.write(body.getBytes("UTF-8")); }
                con.getResponseCode();
                set(app, "Yozuv topilmadi");
            } catch (Exception ignored) {
                // tarmoq yo'q — keyingi safar ham bo'lmaydi, muhim emas
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }
}
