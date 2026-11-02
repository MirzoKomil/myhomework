package uz.domwork.team;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.google.firebase.messaging.FirebaseMessaging;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Domwork Team — CRM'ni (myhomework.uz) ochadigan qobiq: login qilgan xodim o'z rolining kabinetiga tushadi.
 * Push (FCM): token sahifaga window.DomworkNative orqali beriladi, sahifa uni /api/staff/push/register ga yuboradi.
 * Sessiya (token) sahifaning localStorage'ida saqlanadi; ilova faqat myhomework.uz ichida yuradi,
 * tashqi havolalar (tel:, Telegram, PDF va boshqa saytlar) tizim ilovalarida ochiladi.
 */
public class MainActivity extends Activity {
    static final String HOST = "myhomework.uz";
    private static final int NOTIF_REQUEST = 42;
    private static final int FILE_REQUEST = 41;
    private static final int CAMERA_REQUEST = 43;
    private static final int LOCATION_REQUEST = 44;
    /** Sahifa kamera so'raganda tizim ruxsati hali yo'q bo'lsa — ruxsat oynasidan keyin javob beriladi. */
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean showingOffline = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            w.getDecorView().setSystemUiVisibility(flags);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFFF5F7FB);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " DomworkTeam/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return route(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return route(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (!url.startsWith("file:")) showingOffline = false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) showOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            /** Davomat selfiesi: kamera faqat myhomework.uz sahifasiga beriladi (mikrofon va boshqa resurslar — yo'q). */
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    Uri origin = request.getOrigin();
                    boolean ours = origin != null && "https".equals(origin.getScheme()) && isOurHost(origin.getHost());
                    boolean onlyCamera = true;
                    for (String r : request.getResources()) if (!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) onlyCamera = false;
                    if (!ours || !onlyCamera) { request.deny(); return; }
                    if (cameraGranted()) { request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); return; }
                    if (pendingWebPermission != null) pendingWebPermission.deny();
                    pendingWebPermission = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingWebPermission == request) pendingWebPermission = null;
            }

            /** Joylashuv — faqat myhomework.uz uchun, saqlanmaydi (har ochilishda tizim ruxsati tekshiriladi). */
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                Uri u = Uri.parse(origin);
                if (!"https".equals(u.getScheme()) || !isOurHost(u.getHost())) { callback.invoke(origin, false, false); return; }
                if (locationGranted()) { callback.invoke(origin, true, false); return; }
                if (pendingGeoCallback != null) pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
                pendingGeoCallback = callback;
                pendingGeoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
            }
        });
        s.setGeolocationEnabled(true);

        web.addJavascriptInterface(new Bridge(), "DomworkNative");
        PushService.ensureChannel(this);
        refreshToken();
        askNotifications(false);

        Uri data = getIntent() != null ? getIntent().getData() : null;
        String start = data != null && HOST.equals(data.getHost()) ? data.toString() : BuildConfig.APP_URL;
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(start);
    }

    static boolean isOurHost(String host) {
        return host != null && (host.equals(HOST) || host.endsWith("." + HOST));
    }

    private boolean cameraGranted() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean locationGranted() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Ruxsat so'rash; ilgari "boshqa so'ramang" bilan rad etilgan bo'lsa — ilova sozlamalari ochiladi. */
    private void askRuntime(String perm, String[] perms, int code) {
        if (Build.VERSION.SDK_INT < 23) { notifyPage(); return; }
        if (checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) { notifyPage(); return; }
        SharedPreferences p = prefs();
        String key = "asked_" + code;
        if (p.getBoolean(key, false) && !shouldShowRequestPermissionRationale(perm)) { openAppSettings(); return; }
        p.edit().putBoolean(key, true).apply();
        requestPermissions(perms, code);
    }

    private void openAppSettings() {
        safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
    }

    /** true — ilova ichida emas, tashqarida ochildi. */
    private boolean route(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase();
        boolean inside = (scheme.equals("https") && (host.equals(HOST) || host.endsWith("." + HOST)))
                && !path.endsWith(".pdf") && !path.startsWith("/uploads/");
        if (inside) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // mos ilova yo'q — hech narsa qilinmaydi
        }
        return true;
    }

    private void showOffline() {
        if (showingOffline) return;
        showingOffline = true;
        web.loadUrl("file:///android_asset/offline.html");
    }

    /** offline.html'dagi "Qayta urinish" tugmasi shu manzilga o'tadi. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri data = intent.getData();
        if (data != null && HOST.equals(data.getHost())) web.loadUrl(data.toString());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ---------- push ----------
    private SharedPreferences prefs() { return getSharedPreferences(PushService.PREFS, MODE_PRIVATE); }

    private void refreshToken() {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
                if (t.isSuccessful() && t.getResult() != null) {
                    prefs().edit().putString("token", t.getResult()).apply();
                    notifyPage();
                }
            });
        } catch (Exception ignored) { /* Firebase ishga tushmagan */ }
    }

    private boolean notifGranted() {
        if (Build.VERSION.SDK_INT >= 33)
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        return androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled();
    }

    /** force=false — faqat birinchi ochilishda so'raladi; true — sahifadagi "Yoqish" tugmasi. */
    private void askNotifications(boolean force) {
        if (notifGranted()) return;
        SharedPreferences p = prefs();
        boolean asked = p.getBoolean("asked", false);
        if (Build.VERSION.SDK_INT >= 33 && (!asked || (force && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)))) {
            p.edit().putBoolean("asked", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_REQUEST);
        } else if (force) {
            openNotifSettings();
        }
    }

    private void openNotifSettings() {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        }
        safeStart(i);
    }

    private boolean batteryRestricted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        return pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    @SuppressLint("BatteryLife")
    private void openBattery() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        if (!safeStart(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))))
            safeStart(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    }

    /** Xiaomi/Redmi/Poco, Oppo/Realme, Vivo, Huawei/Honor — avtozapusk oynasi; topilmasa ilova sozlamalari. */
    private void openAutostart() {
        String[][] comps = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"}
        };
        for (String[] c : comps) {
            if (safeStart(new Intent().setComponent(new ComponentName(c[0], c[1])))) return;
        }
        safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
    }

    private boolean safeStart(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Sahifaga: holat o'zgardi (ruxsat berildi, sozlamadan qaytdi, token keldi). */
    private void notifyPage() {
        runOnUiThread(() -> {
            if (web != null && !showingOffline)
                web.evaluateJavascript("window.dwNativeChanged&&window.dwNativeChanged()", null);
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == NOTIF_REQUEST) notifyPage();
        if (requestCode == CAMERA_REQUEST) {
            if (pendingWebPermission != null) {
                if (cameraGranted()) pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                else pendingWebPermission.deny();
                pendingWebPermission = null;
            }
            notifyPage();
        }
        if (requestCode == LOCATION_REQUEST) {
            if (pendingGeoCallback != null) {
                pendingGeoCallback.invoke(pendingGeoOrigin, locationGranted(), false);
                pendingGeoCallback = null;
                pendingGeoOrigin = null;
            }
            notifyPage();
        }
    }

    /** Sahifa uchun ko'prik: window.DomworkNative.* */
    private class Bridge {
        @JavascriptInterface public String pushToken() { return prefs().getString("token", ""); }
        @JavascriptInterface public boolean notifGranted() { return MainActivity.this.notifGranted(); }
        @JavascriptInterface public boolean batteryRestricted() { return MainActivity.this.batteryRestricted(); }
        @JavascriptInterface public String manufacturer() { return Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(); }
        @JavascriptInterface public String device() { return (Build.MANUFACTURER + " " + Build.MODEL).trim(); }
        @JavascriptInterface public String appVersion() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public int sdk() { return Build.VERSION.SDK_INT; }
        @JavascriptInterface public void requestNotif() { runOnUiThread(() -> askNotifications(true)); }
        @JavascriptInterface public void openNotifSettings() { runOnUiThread(MainActivity.this::openNotifSettings); }
        @JavascriptInterface public void openBattery() { runOnUiThread(MainActivity.this::openBattery); }
        @JavascriptInterface public void openAutostart() { runOnUiThread(MainActivity.this::openAutostart); }
        @JavascriptInterface public void refresh() { runOnUiThread(MainActivity.this::refreshToken); }
        // Davomat (D00 · ruxsatlar ekrani)
        @JavascriptInterface public boolean cameraGranted() { return MainActivity.this.cameraGranted(); }
        @JavascriptInterface public boolean locationGranted() { return MainActivity.this.locationGranted(); }
        @JavascriptInterface public void requestCamera() { runOnUiThread(() -> askRuntime(Manifest.permission.CAMERA, new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST)); }
        @JavascriptInterface public void requestLocation() { runOnUiThread(() -> askRuntime(Manifest.permission.ACCESS_FINE_LOCATION,
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST)); }
        @JavascriptInterface public void openAppSettings() { runOnUiThread(MainActivity.this::openAppSettings); }
        @JavascriptInterface public void testLocal() {
            PushService.show(MainActivity.this, "Bildirishnoma sinovi", "Shu ko'rinishda xabarlar keladi.", null, "local-test", "local-test");
        }
    }

    @Override
    public void onBackPressed() {
        if (showingOffline) { finish(); return; }
        // Avval sahifa ichidagi oynani (bottom sheet) yopadi — sahifa history.pushState ishlatadi.
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        notifyPage(); // sozlamalardan qaytganda sahifa holatni qayta tekshiradi
    }

    @Override
    protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
