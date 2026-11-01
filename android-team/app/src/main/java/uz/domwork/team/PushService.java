package uz.domwork.team;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * FCM xabarlari: server faqat "data" yuboradi — ilova yopiq bo'lsa ham shu yerda bildirishnoma chiziladi.
 * Bosilganda ilova kerakli sahifada ochiladi (data.url, faqat myhomework.uz).
 */
public class PushService extends FirebaseMessagingService {
    static final String CHANNEL = "domwork_main";
    static final String PREFS = "dwt_push";

    @Override
    public void onNewToken(String token) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("token", token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String title = d.get("title"), body = d.get("body"), url = d.get("url"), tag = d.get("tag"), id = d.get("id");
        if (title == null && msg.getNotification() != null) {
            title = msg.getNotification().getTitle();
            body = msg.getNotification().getBody();
        }
        if (title == null) return;
        show(this, title, body == null ? "" : body, url, tag, id);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Domwork xabarlari", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Yangi lidlar, sinov darslari va eslatmalar");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 250, 120, 250});
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(ch);
    }

    static void show(Context ctx, String title, String body, String url, String tag, String id) {
        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class).setAction(Intent.ACTION_VIEW)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Uri u = url == null ? null : Uri.parse(url);
        if (u != null && "https".equals(u.getScheme()) && MainActivity.HOST.equals(u.getHost())) open.setData(u);
        int code = (id == null ? String.valueOf(System.currentTimeMillis()) : id).hashCode();
        PendingIntent pi = PendingIntent.getActivity(ctx, code, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFF0065D6)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(ctx).notify(tag == null ? "domwork" : tag, code, b.build());
        } catch (SecurityException ignored) {
            // bildirishnoma ruxsati berilmagan
        }
    }
}
