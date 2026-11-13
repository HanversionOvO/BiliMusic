package com.hanversion.bilimusic;

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

/** 独立的 WebDAV 网络层；保留自定义方法、认证及 ETag，不经过 WebView 的 CORS 或 B 站代理。 */
final class WebdavClient {
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS)
        .followSslRedirects(false)
        .build();

    static final class Result {
        final int status;
        final String etag;
        final String contentType;
        final String content;

        Result(int status, String etag, String contentType, String content) {
            this.status = status;
            this.etag = etag;
            this.contentType = contentType;
            this.content = content;
        }
    }

    Result request(String url, String method, Map<String, String> headers, String content) throws IOException {
        method = method.toUpperCase(Locale.ROOT);
        if (!Arrays.asList("GET", "PUT", "MKCOL", "PROPFIND").contains(method)) {
            throw new IllegalArgumentException("不支持的 WebDAV 请求方法");
        }
        Request.Builder builder = new Request.Builder().url(url);
        if (!builder.build().url().username().isEmpty() || !builder.build().url().password().isEmpty()) {
            throw new IllegalArgumentException("请在账号和密码栏填写认证信息");
        }
        for (Map.Entry<String, String> header : headers.entrySet()) builder.header(header.getKey(), header.getValue());
        String contentType = headers.entrySet().stream()
            .filter(entry -> entry.getKey().equalsIgnoreCase("Content-Type"))
            .map(Map.Entry::getValue).findFirst().orElse("application/octet-stream");
        RequestBody body = content != null || method.equals("PUT") || method.equals("MKCOL")
            ? RequestBody.create(content != null ? content : "", MediaType.parse(contentType)) : null;
        builder.method(method, body);
        try (Response response = client.newCall(builder.build()).execute()) {
            ResponseBody responseBody = response.body();
            return new Result(response.code(), response.header("ETag"), response.header("Content-Type"),
                responseBody != null ? responseBody.string() : "");
        }
    }

    void close() {
        client.dispatcher().cancelAll();
        client.connectionPool().evictAll();
    }
}
