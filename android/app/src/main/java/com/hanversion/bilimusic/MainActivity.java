package com.hanversion.bilimusic;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaBridgePlugin.class);
        registerPlugin(WebdavPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Capacitor 的 BridgeWebViewClient 负责本地资源与路由，必须保留其行为；
        // 在其上包一层 B 站代理：非 B 站请求走父类原逻辑。
        Bridge b = getBridge();
        if (b != null) {
            MediaBridge.attach(b);
            b.setWebViewClient(new BiliProxyWebViewClient(b));
        }
    }

    /**
     * B 站请求代理：等价于桌面端 Electron 的 webRequest.onBeforeSendHeaders。
     *
     * WebView 内的 fetch/XHR/audio/img 不能自定义 Referer/Origin（会触发 CORS
     * 或音频 CDN 403），因此在原生层拦截请求、换头发出去，再伪造 CORS 头回给 WebView。
     */
    private static class BiliProxyWebViewClient extends BridgeWebViewClient {

        BiliProxyWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (isBiliUrl(url)) {
                try {
                    return proxyRequest(request, url);
                } catch (Exception e) {
                    Log.w("BiliMusicProxy", "Proxy failed for host " + request.getUrl().getHost(), e);
                    return null;
                }
            }
            return super.shouldInterceptRequest(view, request);
        }

        private static boolean isBiliUrl(String url) {
            return url.startsWith("https://api.bilibili.com")
                || url.startsWith("https://passport.bilibili.com")
                || url.contains(".hdslb.com")
                || url.contains(".bilivideo.com")
                || url.contains(".bilivideo.cn")
                || url.contains(".akamaized.net")
                || url.contains(".biliapi.net");
        }

        private static WebResourceResponse proxyRequest(WebResourceRequest request, String url) throws Exception {
            Map<String, String> reqHeaders = request.getRequestHeaders();
            // WebView 返回普通 Map，HTTP 头名却不区分大小写（可能是 range）。
            // 漏传时 CDN 返回完整文件，长音频 seek 就会退化为从头下载。
            String range = getHeader(reqHeaders, "Range");

            // 拦截请求不走 WebView 自动 Cookie 管线，必须从 CookieManager 主动取
            String cookie = null;
            try {
                cookie = CookieManager.getInstance().getCookie(url);
            } catch (Exception ignored) {
            }

            // 音频流是 CDN 重定向链；带 Range 的请求 HttpURLConnection 不自动跟随，手动跟
            String currentUrl = url;
            HttpURLConnection conn = null;
            int code = -1;
            for (int redirect = 0; redirect < 6; redirect++) {
                if (conn != null) conn.disconnect();
                conn = (HttpURLConnection) new URL(currentUrl).openConnection();
                conn.setRequestProperty("User-Agent", DESKTOP_UA);
                conn.setRequestProperty("Referer", "https://www.bilibili.com");
                conn.setRequestProperty("Origin", "https://www.bilibili.com");
                // 保持字节偏移、Content-Length 与实际流一致，禁止透明 gzip 解压。
                conn.setRequestProperty("Accept-Encoding", "identity");
                if (cookie != null && !cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);
                if (range != null && !range.isEmpty()) conn.setRequestProperty("Range", range);
                // 媒体流（带 Range 的 seek 请求）：长音频定位到几百 MB 偏移时
                // CDN 首字节可能远超 30s，读超时放宽到 5 分钟；普通 API 维持 30s
                boolean isMediaRange = range != null && !range.isEmpty();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(isMediaRange ? 300000 : 30000);

                code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == 307 || code == 308) {
                    String location = conn.getHeaderField("Location");
                    if (location == null) break;
                    currentUrl = new URL(new URL(currentUrl), location).toString();
                    continue;
                }
                break;
            }

            String contentType = conn.getContentType();
            if (range != null) {
                Log.d("BiliMusicMedia", "Range=" + range + ", status=" + code
                    + ", Content-Range=" + conn.getHeaderField("Content-Range"));
            }
            String mimeType = contentType != null ? contentType.split(";")[0].trim() : "application/octet-stream";

            Map<String, String> headers = new HashMap<>();
            // 伪造 CORS：credentials:'include' 时 ACAO 必须是具体来源，不能是 *
            String origin = getHeader(reqHeaders, "Origin");
            headers.put("Access-Control-Allow-Origin", origin != null && !origin.isEmpty()
                ? origin : "https://localhost");
            headers.put("Access-Control-Allow-Credentials", "true");

            // 只透传 WebView 媒体加载需要的头
            for (Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                String key = entry.getKey();
                if (key == null || entry.getValue().isEmpty()) continue;
                String lower = key.toLowerCase(Locale.ROOT);
                if (lower.equals("content-range")) {
                    headers.put("Content-Range", entry.getValue().get(0));
                } else if (lower.equals("content-length")) {
                    headers.put("Content-Length", entry.getValue().get(0));
                } else if (lower.equals("accept-ranges")) {
                    headers.put("Accept-Ranges", entry.getValue().get(0));
                } else if (lower.equals("set-cookie")) {
                    // 代理响应不进 WebView Cookie 管线，登录态 Cookie（SESSDATA 等）
                    // 必须手动写进 CookieManager，否则后续请求带不上登录态
                    for (String cookieValue : entry.getValue()) {
                        setCookie(currentUrl, cookieValue);
                    }
                }
            }

            InputStream openedStream;
            try {
                openedStream = conn.getInputStream();
            } catch (Exception e) {
                // 错误响应必须保留真实状态和内容，不能把空流与原 Content-Length
                // 拼成 502；否则媒体加载器会等待永远不会到达的字节。
                openedStream = conn.getErrorStream();
                if (openedStream == null) {
                    conn.disconnect();
                    throw e;
                }
            }
            final InputStream rawStream = RangeResponseInputStream.wrap(openedStream, range, code,
                conn.getHeaderField("Content-Range"), conn.getContentLengthLong());

            // 媒体流必须透传 close：WebView seek 时 abort 旧请求会 close 流，
            // close 同步 disconnect 释放后端 CDN 连接。
            final HttpURLConnection connRef = conn;
            InputStream managed = new InputStream() {
                private final InputStream delegate = rawStream;

                @Override
                public int read() throws java.io.IOException {
                    return delegate.read();
                }

                @Override
                public int read(byte[] b) throws java.io.IOException {
                    return delegate.read(b);
                }

                @Override
                public int read(byte[] b, int off, int len) throws java.io.IOException {
                    return delegate.read(b, off, len);
                }

                @Override
                public long skip(long count) throws java.io.IOException {
                    return delegate.skip(count);
                }

                @Override
                public int available() throws java.io.IOException {
                    return delegate.available();
                }

                @Override
                public void close() throws java.io.IOException {
                    try {
                        delegate.close();
                    } finally {
                        connRef.disconnect();
                    }
                }
            };

            WebResourceResponse resp = new WebResourceResponse(mimeType, null, managed);
            resp.setStatusCodeAndReasonPhrase(code, reasonFor(code));
            resp.setResponseHeaders(headers);
            return resp;
        }

        private static String getHeader(Map<String, String> headers, String name) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                if (name.equalsIgnoreCase(entry.getKey())) return entry.getValue();
            }
            return null;
        }

        private static void setCookie(String url, String cookieValue) {
            try {
                // 只保留 name=value；Domain/Path 等属性由 CookieManager 自行处理
                String pair = cookieValue.split(";")[0].trim();
                if (pair.isEmpty()) return;
                CookieManager cm = CookieManager.getInstance();
                String target = url.startsWith("https://passport.")
                    ? "https://.bilibili.com" : url;
                cm.setCookie(target, pair);
                // flush 需要在主线程调用，持久化到磁盘
                new Handler(Looper.getMainLooper()).post(() -> cm.flush());
            } catch (Exception ignored) {
            }
        }
    }

    private static final String DESKTOP_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static String reasonFor(int code) {
        switch (code) {
            case 200: return "OK";
            case 206: return "Partial Content";
            case 302: return "Found";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 502: return "Bad Gateway";
            default: return "Status " + code;
        }
    }
}
