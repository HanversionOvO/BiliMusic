package com.hanversion.bilimusic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

/**
 * 前台媒体服务：锁屏/通知栏控制。
 *
 * WebView 的 <audio> 只在 Activity 前台时可靠播放，把服务提升为前台
 * media 类型后系统不会冻结 WebView 渲染进程，音频得以后台续播；
 * 通知栏的播放/暂停/上下曲按钮经 MediaSession 回调转发到 WebView。
 */
public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID = "bilimusic_playback";
    private static final int NOTIFICATION_ID = 1001;
    public static final String ACTION_SYNC = "com.hanversion.bilimusic.SYNC_STATE";

    private MediaSessionCompat mediaSession;
    private String title = "BiliMusic";
    private String artist = "";
    private String coverUrl = "";
    private boolean playing = false;
    private long positionMillis;
    private long durationMillis;
    private Bitmap artwork;
    private Bitmap fallbackArtwork;
    private MediaArtworkLoader artworkLoader;
    private boolean foregroundStarted;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        artworkLoader = new MediaArtworkLoader();
        Drawable icon = getApplicationInfo().loadIcon(getPackageManager());
        fallbackArtwork = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888);
        icon.setBounds(0, 0, 512, 512);
        icon.draw(new Canvas(fallbackArtwork));
        artwork = fallbackArtwork;
        mediaSession = new MediaSessionCompat(this, "BiliMusic");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                MediaBridge.emit("play");
                playing = true;
                updatePlaybackState();
                startForegroundWithNotification();
            }

            @Override
            public void onPause() {
                MediaBridge.emit("pause");
                playing = false;
                updatePlaybackState();
                updateNotification();
            }

            @Override
            public void onSkipToNext() {
                MediaBridge.emit("next");
            }

            @Override
            public void onSkipToPrevious() {
                MediaBridge.emit("prev");
            }

            @Override
            public void onSeekTo(long position) {
                positionMillis = Math.max(0, Math.min(position, durationMillis));
                MediaBridge.emitSeekTo(positionMillis);
                updatePlaybackState();
            }

            @Override
            public void onStop() {
                MediaBridge.emit("pause");
                playing = false;
                foregroundStarted = false;
                stopForeground(true);
                stopSelf();
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_SYNC.equals(action)) {
            String nextCover = MediaArtworkLoader.normalizeUrl(intent.getStringExtra("coverUrl"));
            boolean coverChanged = !nextCover.equals(coverUrl);
            boolean metadataChanged = coverChanged
                || !title.equals(intent.getStringExtra("title"))
                || !artist.equals(intent.getStringExtra("artist"))
                || durationMillis != intent.getLongExtra("duration", 0);
            boolean playingChanged = playing != intent.getBooleanExtra("playing", false);
            title = intent.getStringExtra("title");
            artist = intent.getStringExtra("artist");
            coverUrl = nextCover;
            positionMillis = Math.max(0, intent.getLongExtra("position", 0));
            durationMillis = Math.max(0, intent.getLongExtra("duration", 0));
            playing = intent.getBooleanExtra("playing", false);
            if (title == null) title = "BiliMusic";
            if (artist == null) artist = "";
            if (coverChanged) artwork = fallbackArtwork;
            if (metadataChanged) updateMetadata();
            if (!foregroundStarted) startForegroundWithNotification();
            else if (metadataChanged || playingChanged) updateNotification();
            updatePlaybackState();
            if (coverChanged) {
                artworkLoader.load(coverUrl, bitmap -> {
                    artwork = bitmap != null ? bitmap : fallbackArtwork;
                    updateMetadata();
                    if (foregroundStarted) updateNotification();
                });
            }
        }
        return START_NOT_STICKY;
    }

    private void updatePlaybackState() {
        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMillis, playing ? 1f : 0f)
            .build();
        mediaSession.setPlaybackState(state);
    }

    private void updateMetadata() {
        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMillis)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artwork)
            .build());
    }

    private void startForegroundWithNotification() {
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        foregroundStarted = true;
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        // 点击通知回到 App
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launch != null
            ? PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            : null;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setOngoing(playing)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true);

        builder.setLargeIcon(artwork);

        // MediaStyle：锁屏/通知栏的播放控制由 MediaSession 驱动
        androidx.media.app.NotificationCompat.MediaStyle style =
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);
        builder.setStyle(style);

        builder.addAction(buildAction(R.drawable.ic_stat_prev, "上一首", PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));
        if (playing) {
            builder.addAction(buildAction(R.drawable.ic_stat_pause, "暂停", PlaybackStateCompat.ACTION_PAUSE));
        } else {
            builder.addAction(buildAction(R.drawable.ic_stat_play, "播放", PlaybackStateCompat.ACTION_PLAY));
        }
        builder.addAction(buildAction(R.drawable.ic_stat_next, "下一首", PlaybackStateCompat.ACTION_SKIP_TO_NEXT));

        return builder.build();
    }

    private NotificationCompat.Action buildAction(int icon, String title, long action) {
        PendingIntent pi = MediaButtonReceiver.buildMediaButtonPendingIntent(this, action);
        return new NotificationCompat.Action(icon, title, pi);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "播放控制", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("音乐播放状态与控制");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        foregroundStarted = false;
        if (artworkLoader != null) artworkLoader.close();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }
}
