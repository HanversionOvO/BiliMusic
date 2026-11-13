package com.hanversion.bilimusic;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.LruCache;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 封面在工作线程下载、解码，结果在主线程发布；旧曲目的迟到响应不能覆盖新封面。 */
final class MediaArtworkLoader implements AutoCloseable {
    interface Callback { void onLoaded(Bitmap bitmap); }
    interface Downloader { Bitmap download(String url) throws Exception; }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final LruCache<String, Bitmap> cache = new LruCache<String, Bitmap>(6 * 1024) {
        @Override protected int sizeOf(String key, Bitmap bitmap) {
            return Math.max(1, bitmap.getAllocationByteCount() / 1024);
        }
    };
    private final Downloader downloader;
    private int generation;
    private boolean closed;

    MediaArtworkLoader() { this(MediaArtworkLoader::downloadBitmap); }
    MediaArtworkLoader(Downloader downloader) { this.downloader = downloader; }

    void load(String url, Callback callback) {
        final int request = ++generation;
        final String normalized = normalizeUrl(url);
        Bitmap cached = cache.get(normalized);
        if (cached != null || normalized.isEmpty()) {
            if (!closed) callback.onLoaded(cached);
            return;
        }
        if (closed) return;
        executor.execute(() -> {
            Bitmap bitmap = null;
            try {
                bitmap = downloader.download(normalized);
                if (bitmap != null) {
                    cache.put(normalized, bitmap);
                    Log.d("BiliMusicArtwork", "Loaded artwork " + bitmap.getWidth() + "x" + bitmap.getHeight());
                }
            } catch (Exception e) {
                Log.w("BiliMusicArtwork", "Could not load media artwork: " + e.getClass().getSimpleName());
            }
            final Bitmap result = bitmap;
            main.post(() -> {
                if (!closed && request == generation) callback.onLoaded(result);
            });
        });
    }

    static String normalizeUrl(String url) {
        if (url == null) return "";
        String value = url.trim();
        if (value.startsWith("//")) return "https:" + value;
        if (value.startsWith("http://")) return "https://" + value.substring(7);
        return value;
    }

    private static Bitmap downloadBitmap(String value) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(value).openConnection();
        try {
            connection.setRequestProperty("Referer", "https://www.bilibili.com/");
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("Artwork HTTP request failed");
            }
            byte[] bytes;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new IOException("Artwork request cancelled");
                    if (output.size() + count > 8 * 1024 * 1024) throw new IOException("Artwork is too large");
                    output.write(buffer, 0, count);
                }
                bytes = output.toByteArray();
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 1;
            int longest = Math.max(bounds.outWidth, bounds.outHeight);
            while (longest / (options.inSampleSize * 2) >= 512) options.inSampleSize *= 2;
            Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (decoded == null) throw new IOException("Invalid artwork image");
            int size = Math.max(decoded.getWidth(), decoded.getHeight());
            if (size <= 512) return decoded;
            float scale = 512f / size;
            Bitmap scaled = Bitmap.createScaledBitmap(decoded,
                Math.max(1, Math.round(decoded.getWidth() * scale)),
                Math.max(1, Math.round(decoded.getHeight() * scale)), true);
            if (scaled != decoded) decoded.recycle();
            return scaled;
        } finally {
            connection.disconnect();
        }
    }

    @Override public void close() {
        closed = true;
        ++generation;
        executor.shutdownNow();
        cache.evictAll();
    }
}
