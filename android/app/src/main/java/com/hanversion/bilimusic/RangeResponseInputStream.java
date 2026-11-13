package com.hanversion.bilimusic;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * WebView 会对 shouldInterceptRequest 返回的流再次执行 Range 起点的 skip。
 * CDN 的 206 已经截去了这段前缀，只确认这一次 skip，不能再丢弃真实音频字节。
 * read 始终返回原始响应体，兼容不再重复 skip 的 WebView。
 */
final class RangeResponseInputStream extends FilterInputStream {
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d+)-(\\d*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CONTENT_RANGE = Pattern.compile("bytes (\\d+)-(\\d+)/(?:\\d+|\\*)", Pattern.CASE_INSENSITIVE);
    private long prefixRemaining;
    private long bodyRemaining;

    RangeResponseInputStream(InputStream body, long offset, long bodyLength) {
        super(body);
        prefixRemaining = offset;
        bodyRemaining = bodyLength;
    }

    static InputStream wrap(InputStream body, String range, int status, String contentRange, long bodyLength) {
        if (status != 206 || range == null || contentRange == null) return body;
        Matcher request = RANGE.matcher(range.trim());
        Matcher response = CONTENT_RANGE.matcher(contentRange.trim());
        if (!request.matches() || !response.matches()) return body;
        try {
            long offset = Long.parseLong(request.group(1));
            if (offset != Long.parseLong(response.group(1)) || offset == 0) return body;
            return new RangeResponseInputStream(body, offset, bodyLength);
        } catch (NumberFormatException ignored) {
            return body;
        }
    }

    @Override public int available() throws IOException {
        // Chromium 用 available 校验请求起点并计算响应长度。超过 int 的流返回未知长度。
        if (bodyRemaining < 0 || prefixRemaining > Integer.MAX_VALUE - bodyRemaining) return 0;
        return (int) (prefixRemaining + bodyRemaining);
    }

    @Override public long skip(long count) throws IOException {
        if (count <= 0) return 0;
        long acknowledged = Math.min(prefixRemaining, count);
        prefixRemaining -= acknowledged;
        long skipped = count > acknowledged ? in.skip(count - acknowledged) : 0;
        if (bodyRemaining >= 0) bodyRemaining = Math.max(0, bodyRemaining - skipped);
        return acknowledged + skipped;
    }

    @Override public int read() throws IOException {
        prefixRemaining = 0;
        int result = in.read();
        if (result >= 0 && bodyRemaining > 0) bodyRemaining--;
        return result;
    }

    @Override public int read(byte[] buffer, int offset, int length) throws IOException {
        prefixRemaining = 0;
        int count = in.read(buffer, offset, length);
        if (count > 0 && bodyRemaining >= 0) bodyRemaining = Math.max(0, bodyRemaining - count);
        return count;
    }
}
