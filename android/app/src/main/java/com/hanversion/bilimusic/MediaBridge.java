package com.hanversion.bilimusic;

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import java.lang.ref.WeakReference;

import com.getcapacitor.Bridge;

/**
 * WebView 与媒体服务之间的双向桥。
 *
 * JS -> 原生：MediaBridgePlugin.syncState() 同步曲目/播放态，更新通知。
 * 原生 -> JS：通知栏按钮回调 emit()，经 evaluateJavascript 派发到
 * window.dispatchEvent(new CustomEvent('bilimusic:media-command', {detail: cmd}))。
 */
public class MediaBridge {

    private static WeakReference<WebView> webViewRef;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    static void attach(Bridge bridge) {
        webViewRef = new WeakReference<>(bridge.getWebView());
    }

    static void emit(String command) {
        mainHandler.post(() -> {
            WebView wv = webViewRef != null ? webViewRef.get() : null;
            if (wv == null) return;
            String js = "window.dispatchEvent(new CustomEvent('bilimusic:media-command',{detail:'" + command + "'}))";
            wv.evaluateJavascript(js, null);
        });
    }

    static void emitSeekTo(long positionMillis) {
        mainHandler.post(() -> {
            WebView wv = webViewRef != null ? webViewRef.get() : null;
            if (wv == null) return;
            wv.evaluateJavascript("window.dispatchEvent(new CustomEvent('bilimusic:media-seek',{detail:"
                + Math.max(0, positionMillis) / 1000.0 + "}))", null);
        });
    }
}
