package com.hanversion.bilimusic;

import static org.junit.Assert.*;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.os.Looper;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.core.app.ActivityScenario;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

@RunWith(AndroidJUnit4.class)
public class MediaArtworkTest {
    private void onMain(Runnable runnable) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(runnable);
    }

    private Bitmap image(int color) {
        Bitmap bitmap = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888);
        bitmap.eraseColor(color);
        return bitmap;
    }

    @Test public void downloadRunsOffMainThreadAndPauseUpdatesReuseCache() throws Exception {
        AtomicInteger downloads = new AtomicInteger();
        Bitmap expected = image(Color.RED);
        MediaArtworkLoader loader = new MediaArtworkLoader(url -> {
            assertNotSame(Looper.getMainLooper(), Looper.myLooper());
            downloads.incrementAndGet();
            return expected;
        });
        try {
            CountDownLatch first = new CountDownLatch(1);
            onMain(() -> loader.load("https://cover.example/a.jpg", bitmap -> {
                assertSame(Looper.getMainLooper(), Looper.myLooper());
                assertSame(expected, bitmap);
                first.countDown();
            }));
            assertTrue(first.await(5, TimeUnit.SECONDS));
            CountDownLatch cached = new CountDownLatch(1);
            onMain(() -> loader.load("https://cover.example/a.jpg", bitmap -> {
                assertSame(expected, bitmap);
                cached.countDown();
            }));
            assertTrue(cached.await(5, TimeUnit.SECONDS));
            assertEquals(1, downloads.get());
        } finally {
            onMain(loader::close);
        }
    }

    @Test public void delayedOldCoverCannotReplaceCurrentCover() throws Exception {
        CountDownLatch slowStarted = new CountDownLatch(1);
        CountDownLatch releaseSlow = new CountDownLatch(1);
        CountDownLatch obsolete = new CountDownLatch(1);
        CountDownLatch latest = new CountDownLatch(1);
        MediaArtworkLoader loader = new MediaArtworkLoader(url -> {
            if (url.endsWith("slow")) {
                slowStarted.countDown();
                releaseSlow.await(5, TimeUnit.SECONDS);
                return image(Color.RED);
            }
            return image(Color.BLUE);
        });
        try {
            onMain(() -> loader.load("https://cover.example/slow", bitmap -> obsolete.countDown()));
            assertTrue(slowStarted.await(5, TimeUnit.SECONDS));
            onMain(() -> loader.load("https://cover.example/fast", bitmap -> {
                assertEquals(Color.BLUE, bitmap.getPixel(0, 0));
                latest.countDown();
            }));
            assertTrue(latest.await(5, TimeUnit.SECONDS));
            releaseSlow.countDown();
            assertFalse(obsolete.await(500, TimeUnit.MILLISECONDS));
        } finally {
            releaseSlow.countDown();
            onMain(loader::close);
        }
    }

    @Test public void destroyedServiceCannotPublishLateArtwork() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch callback = new CountDownLatch(1);
        MediaArtworkLoader loader = new MediaArtworkLoader(url -> {
            started.countDown();
            release.await(5, TimeUnit.SECONDS);
            return image(Color.BLUE);
        });
        onMain(() -> loader.load("https://cover.example/slow", bitmap -> callback.countDown()));
        assertTrue(started.await(5, TimeUnit.SECONDS));
        onMain(loader::close);
        release.countDown();
        assertFalse(callback.await(500, TimeUnit.MILLISECONDS));
    }

    @Test public void realBiliCoverIsPublishedToNotificationAndSystemMediaSession() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class);
        // 等渲染器首次挂载完成，避免初始的空曲目 stop() 与测试服务启动竞争。
        AtomicBoolean rendererReady = new AtomicBoolean();
        long rendererDeadline = SystemClock.elapsedRealtime() + 20000;
        while (!rendererReady.get() && SystemClock.elapsedRealtime() < rendererDeadline) {
            CountDownLatch sample = new CountDownLatch(1);
            activity.onActivity(app -> app.getBridge().getWebView().evaluateJavascript(
                "Boolean(document.getElementById('root') && document.getElementById('root').childElementCount)",
                result -> { rendererReady.set("true".equals(result)); sample.countDown(); }));
            assertTrue(sample.await(3, TimeUnit.SECONDS));
            if (!rendererReady.get()) SystemClock.sleep(100);
        }
        assertTrue("Renderer did not mount", rendererReady.get());
        SystemClock.sleep(500);
        Intent sync = new Intent(context, MediaPlaybackService.class)
            .setAction(MediaPlaybackService.ACTION_SYNC)
            .putExtra("title", "Artwork integration test")
            .putExtra("artist", "BiliMusic")
            .putExtra("coverUrl", "http://i2.hdslb.com/bfs/archive/25c409c43790cc13bf9ebc473b36c4f650527653.jpg")
            .putExtra("playing", false)
            .putExtra("position", 121000L)
            .putExtra("duration", 25142000L);
        try {
            context.startForegroundService(sync);
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            long deadline = SystemClock.elapsedRealtime() + 25000;
            boolean loaded = false;
            while (SystemClock.elapsedRealtime() < deadline) {
                for (StatusBarNotification entry : manager.getActiveNotifications()) {
                    Notification notification = entry.getNotification();
                    if (!"Artwork integration test".contentEquals(notification.extras.getCharSequence(Notification.EXTRA_TITLE, ""))) continue;
                    MediaSession.Token token = notification.extras.getParcelable(Notification.EXTRA_MEDIA_SESSION);
                    assertNotNull(token);
                    MediaController controller = new MediaController(context, token);
                    MediaMetadata metadata = controller.getMetadata();
                    if (metadata == null) continue;
                    Bitmap artwork = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
                    // 实际视频封面是横图；默认应用图标是方图，不能把兜底图误判为成功。
                    if (artwork == null || artwork.getWidth() <= artwork.getHeight()) continue;
                    assertTrue(artwork.getWidth() <= 512);
                    assertNotNull(notification.getLargeIcon());
                    assertNotNull(metadata.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON));
                    assertEquals(25142000L, metadata.getLong(MediaMetadata.METADATA_KEY_DURATION));
                    assertEquals(121000L, controller.getPlaybackState().getPosition());
                    loaded = true;
                }
                if (loaded) break;
                SystemClock.sleep(100);
            }
            assertTrue("Real Bili cover was not published to Android media metadata", loaded);
        } finally {
            context.stopService(new Intent(context, MediaPlaybackService.class));
            activity.close();
        }
    }
}
