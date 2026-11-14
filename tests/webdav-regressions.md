# WebDAV 回归检查

```powershell
node --experimental-vm-modules --test tests/webdavWeb.test.mjs tests/webdavElectron.test.mjs
./android/gradlew.bat -p android :app:testDebugUnitTest
```

- 前端检查 Android 原生传输、浏览器回退、UTF-8 Basic 认证、207、401/403/500、MKCOL、JSON/ETag 及 412。
- 原生检查自定义方法、请求体、超时、服务器状态保留，以及跨来源重定向时移除认证头。
- 目录不存在导致 GET 409 时先 MKCOL 再读取；目录创建失败或持续 409 时停止同步，不误判为空资料库。
- 对应实现已在 Android 14 模拟器的设置页验证真实坚果云连接、首次同步、云端下载和条件再次同步。自动测试使用占位凭据和本地模拟服务器。

不要把真实账号、应用密码、认证头或云端数据写入源码及日志。
