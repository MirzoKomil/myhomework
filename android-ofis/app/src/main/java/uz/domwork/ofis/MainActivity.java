package uz.domwork.ofis;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * "Ofis" — myhomework.uz/ofis (jonli ofis) qobig'i. Telefon: oddiy ko'rinish. Android TV / pristavka:
 * avtomatik TV rejimi (?tv=1), to'liq ekran, ekran o'chmaydi. Ilova faqat myhomework.uz ichida yuradi;
 * boshqa havolalar tizim brauzerida ochiladi. Kirish — CRM login/paroli (sahifaning o'z oynasi).
 */
public class MainActivity extends Activity {
    static final String HOST = "myhomework.uz";
    private WebView web;
    private boolean tv;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiModeManager ui = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        tv = ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        // Ofis ekrani doim ko'rinib tursin (TV va telefonda ochiq turganda).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFFF7EFE3);
        setContentView(web);
        if (tv) immersive();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // Sotuvdagi qarsak va ofis shovqini teginishsiz ham eshitilsin (TV'da teginish yo'q).
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " DomworkOfis/" + BuildConfig.VERSION_NAME + (tv ? " TV" : ""));
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
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) offline();
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BuildConfig.APP_URL + (tv ? "?tv=1" : ""));
    }

    /** myhomework.uz ichida — ilovada; boshqa manzil — tizim brauzerida. */
    private boolean route(Uri uri) {
        String host = uri.getHost();
        if ("https".equals(uri.getScheme()) && host != null && (host.equals(HOST) || host.endsWith("." + HOST))) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
        return true;
    }

    private void offline() {
        String html = "<html><body style='font-family:sans-serif;background:#F7EFE3;color:#14213D;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center'>"
            + "<div><h2>Internet yo'q</h2><p>Ulanish tiklangach ofis o'zi qayta ochiladi.</p></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        web.postDelayed(() -> web.loadUrl(BuildConfig.APP_URL + (tv ? "?tv=1" : "")), 15000);
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && tv) immersive();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) { web.goBack(); return true; }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }
}
