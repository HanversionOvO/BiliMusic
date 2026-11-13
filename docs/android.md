# Android 开发说明

Android 客户端通过 Capacitor 加载现有 React 界面，使用原生插件提供后台媒体控制及 WebDAV 传输。桌面端仍使用原有 Electron 路径。

## 环境

- Node.js 22 或更新版本，建议 Node.js 24。
- JDK 21，并将 `JAVA_HOME` 指向该 JDK。
- Android SDK 36、Build Tools 36.0.0；Android Studio 可用于安装 SDK 和运行模拟器。
- 最低运行版本为 Android 7.0（API 24）。

## 同步与构建

```powershell
npm ci
npm run android:sync
./android/gradlew.bat -p android :app:assembleDebug
```

`android:sync` 先构建前端，再复制资源和同步 Capacitor 配置。Gradle 构建应在同步结束后执行。本机 SDK 路径可在 Android Studio 中配置，或写入不入库的 `android/local.properties`。

安装到已连接的模拟器或设备：

```powershell
npm run android:run
```

## Release 签名

在本地创建 `android/keystore.properties`，内容示例：

```properties
storeFile=release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

`storeFile` 相对于 `android` 目录。不要提交实际密钥、密码文件或本机 SDK 配置。

```powershell
npm run android:sync
./android/gradlew.bat -p android :app:assembleRelease
```

产物位于 `android/app/build/outputs/apk/release/`。未配置签名时生成未签名的 release APK，需要自行签名后安装。本贡献不提供或上传任何个人签名密钥，也不修改上游桌面端的版本、发布地址和工作流。

## 平台行为

- 移动端使用底部导航和适合触摸的播放详情页，底部五个播放控制按钮居中。
- Android 使用系统音量，界面内不提供桌面音量滑条。
- 原生前台媒体服务提供通知栏和锁屏控制，封面异步加载、缩放和缓存，并丢弃过期请求。
- Bilibili 音频拦截保留服务器的 206 与 Content-Range，避免 WebView 对已截取的范围流再次跳过相同字节。
- WebDAV 在 Android 上使用原生 HTTP 客户端，支持 PROPFIND、GET、MKCOL、PUT 和 ETag 条件写入。浏览器保留 fetch 回退。
- 坚果云首次同步遇到父目录不存在导致的 GET 409 时，先创建目录再读取；失败状态不会被当作空资料库。Electron 同步也应用相同修复。
- 字体随应用打包，以避免依赖外部字体服务；字体许可随包保存在 `licenses/`。

分 P 合集总进度定位属于独立的播放修复贡献；本 Android 分支保留上游播放时间线逻辑，两个贡献可分别审查。

## 检查

```powershell
node --experimental-vm-modules --test tests/webdavWeb.test.mjs tests/webdavElectron.test.mjs
./android/gradlew.bat -p android :app:testDebugUnitTest
```

原生单元测试覆盖范围流和 WebDAV，WebDAV 测试使用本地模拟服务器。

在测试设备上验证通知和锁屏封面（需要网络访问 Bilibili 图片 CDN）：

```powershell
./android/gradlew.bat -p android :app:assembleDebug :app:assembleDebugAndroidTest
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -r -e class com.hanversion.bilimusic.MediaArtworkTest com.hanversion.bilimusic.test/androidx.test.runner.AndroidJUnitRunner
```

测试会修改测试设备中的媒体会话状态。调试包可通过 `Capacitor.DEBUG` 暴露音频对象以检查播放状态；release 包不暴露该对象。另见 [WebDAV 回归说明](../tests/webdav-regressions.md)。
