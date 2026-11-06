# 局外音乐与播放器

已接入用户放在 `assets/audio/_source/音乐/` 的四首完整作品。原始WAV不修改、不入库；运行时使用44.1kHz、双声道、192kbps MP3，不裁切、不额外处理原曲响度。

| 曲目 | 时长 | 成品大小 | 运行时文件 |
|---|---:|---:|---|
| 退潮之后 / After the Ebb | 3:23 | 4.65MiB | `assets/audio/bgm_base.mp3` |
| 无人应答 / No One Answers | 3:49 | 5.25MiB | `assets/audio/bgm_no_one_answers.mp3` |
| 越过灰色地带 / Beyond the Grey | 3:09 | 4.34MiB | `assets/audio/bgm_beyond_the_grey.mp3` |
| 照常营业 / Business as Usual（商店主题） | 3:03 | 4.19MiB | `assets/audio/bgm_business_as_usual.mp3` |

原稿合计约135.46MiB，成品合计18.44MiB。单文件版内联压缩音乐，base64数据约24.58MiB；以后曲库继续扩大时，应评估单文件总体体积。

## 玩家操作

藏身处顶部的「局外音乐」打开播放器；手机端使用音符按钮。支持曲目选择、上一首/下一首、暂停/播放、拖动进度、独立音量、顺序循环/单曲循环/随机播放。曲目列表超过面板高度后滚动。

曲目、音量、播放方式和手动暂停状态存于独立的 `tideline_music_v1` 设置，不改游戏存档。进入战局淡出停止，结算与回到藏身处恢复所选曲目；手动暂停后保持暂停。选图页仍属于局外。浏览器阻止自动播放时，首次交互后重试；进局会清除重试监听，避免后续点击让局外音乐在战局中复播。

进入具体商店（包含医生和私人事务所）时，局外曲用0.9秒淡至静音、记录进度并暂停，然后开始《照常营业》，实际开始播放后用0.8秒淡入。商人总览保持普通局外曲；离开具体商店，以相同步骤恢复先前曲目和进度。各商店、买卖页签与交易刷新不重播音乐。商店曲在商店内循环，普通局外顺序/随机播放池仍为原来的三首；播放器也可手动选择商店曲试听。

自动场景切换不覆盖局外选曲偏好，不解除手动暂停。歌曲进度在本次页面会话内记忆；刷新仍按所选曲目从头载入。快速来回切页或淡出时出击，会取消过期回调，避免错误的商店曲迟到播放。音量控制在淡出期间调整下一段的目标音量，保持当前淡出连续。

## 构建与继续加歌

- `assets/audio/manifest.json` 的 `music` 表是曲库来源，与短音效 `assets` 表分开。每首记录稳定ID、中英文标题、来源路径、时长、编码参数和成品哈希。
- `tools/build-music-data.js` 生成 `js/music-player.js` 的曲库块，界面由曲库自动生成。
- 音乐复用一个HTMLAudioElement，按需播放当前曲目，不调用SFX的整曲PCM解码。HTTP版直接读取MP3，本地多文件版通过音频bundle载入，离线单文件版内联。
- `build.js` 保留单曲6MiB上限，超限报错，避免离线版缺歌。

重导入当前四首（需要FFmpeg和同目录的FFprobe；添加 `--only=business_as_usual` 可只转换商店曲）：

```powershell
node tools/prepare-lobby-music.js --ffmpeg=D:/develop/model/tide-media-tools/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe
node build.js --audio-only
node build.js --assets-only
```

FFmpeg便携工具来自[官方网站所列下载渠道](https://www.ffmpeg.org/download.html)的[Gyan构建](https://www.gyan.dev/ffmpeg/builds/)，下载包SHA256已核对。工具不属于项目运行依赖。

后续曲目导出为 `assets/audio/bgm_<id>.mp3`，通过已有登记工具加入，再构建：

```powershell
node tools/audio-add.js assets/audio/bgm_example.mp3 --music --id=example --title=曲名 --english="English Title" --scene=lobby --original="assets/audio/_source/音乐/源.wav" --from=user-lobby-music --ffprobe=ffprobe
node build.js --audio-only
node build.js --assets-only
```

## 验证

```powershell
node tools/test-music-player.js
node tools/test-music-player-browser.js
```

单元检查覆盖10组：登记/哈希、单播放实例、切歌/循环、设置持久化、进度限制、自动播放拦截与进局清理、无效设置回退、商店优先与恢复、过渡中暂停/音量控制、快速切页与进局回调取消。

Edge浏览器实际解码并播放四首MP3，验证播放器、自然结束、刷新记忆及库存不变；记录原曲暂停时音量为0，确认商店过渡、商店内循环、原曲续播、快速切页与淡出中出击。HTTP版、`file://` 离线单文件版、本地多文件音频bundle均通过；布局覆盖1440、1280、390与320像素宽度。详见同目录验证JSON与截图。
