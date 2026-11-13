package com.hanversion.bilimusic;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaBridge")
public class MediaBridgePlugin extends Plugin {

    private boolean notificationsGranted() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void syncState(PluginCall call) {
        // Android 13+ 首次同步时请求通知权限（仅一次；拒绝后静默降级，播放不受影响）
        if (!notificationsGranted()) {
            ActivityCompat.requestPermissions(
                getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }

        String title = call.getString("title", "BiliMusic");
        String artist = call.getString("artist", "");
        String coverUrl = call.getString("coverUrl", "");
        boolean playing = call.getBoolean("playing", false);

        Intent intent = new Intent(getContext(), MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_SYNC);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("coverUrl", coverUrl);
        intent.putExtra("playing", playing);
        intent.putExtra("position", Math.max(0, (long) (call.getDouble("position", 0.0) * 1000)));
        intent.putExtra("duration", Math.max(0, (long) (call.getDouble("duration", 0.0) * 1000)));

        try {
            if (Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Exception e) {
            // 前台服务启动被系统拒绝（如应用处于后台限制）时降级：不起服务，播放仍继续
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaPlaybackService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
