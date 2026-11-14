package com.hanversion.bilimusic;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InterruptedIOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "Webdav")
public class WebdavPlugin extends Plugin {
    private final WebdavClient client = new WebdavClient();
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body");
        JSObject inputHeaders = call.getObject("headers", new JSObject());
        Map<String, String> headers = new HashMap<>();
        for (Iterator<String> keys = inputHeaders.keys(); keys.hasNext();) {
            String key = keys.next();
            headers.put(key, inputHeaders.optString(key));
        }
        executor.execute(() -> {
            try {
                WebdavClient.Result result = client.request(url, method, headers, body);
                JSObject response = new JSObject();
                response.put("status", result.status);
                response.put("body", result.content);
                JSObject responseHeaders = new JSObject();
                if (result.etag != null) responseHeaders.put("etag", result.etag);
                if (result.contentType != null) responseHeaders.put("content-type", result.contentType);
                response.put("headers", responseHeaders);
                call.resolve(response);
            } catch (InterruptedIOException error) {
                call.reject("WebDAV 连接超时，请检查网络后重试", "TIMEOUT");
            } catch (IllegalArgumentException error) {
                call.reject("WebDAV 地址或请求格式无效", "INVALID_REQUEST");
            } catch (Exception error) {
                // 不输出请求头、账号、密码或服务端目录内容。
                call.reject("无法连接 WebDAV，请检查网络和服务器地址", "NETWORK_ERROR");
            }
        });
    }

    @Override protected void handleOnDestroy() {
        client.close();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
