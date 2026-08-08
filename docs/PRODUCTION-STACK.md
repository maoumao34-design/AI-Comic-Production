# 生产栈锁定（样片风格 × 本机 12GB）

> 状态：**已拍板**（2026-08-08，本机 agent 执行）  
> 依据：`references/07-样片-sample.mp4`（9:16 AI 真人 + 英文旁白 + 烧录字幕）+ RTX 5070 Ti Laptop 12GB。

## 1. 风格目标

- 电影感 **AI 真人**（非漫画/二次元）
- 竖屏 **9:16**；生成建议 832×1216，成片导出 720×1280
- 英文 VO + 底部白字烧录字幕（对齐样片包装）
- 角色跨镜一致；画面必须对应解说节拍

## 2. 平台锁定

| 步骤 | 主路径 | 备注 |
|---|---|---|
| 03 资产 | **本机 ComfyUI** + **RealVisXL V5.0** | FaceID/IP-Adapter 增强一致性（节点就绪后启用） |
| 04 关键帧 | **本机 ComfyUI** img2img，引用 03 脸/场景 | 独立工作流 `workflows/04-keyframes/` |
| 05 视频 | **本机 Wan 2.1 I2V（草稿）**；成片候选 **Kling / Seedance** | 先本机跑通，导演对比样片后再锁云端精修 |
| 06 配音 | **ElevenLabs** 英文旁白 | 需 `ELEVENLABS_API_KEY` |
| 07 合成 | **ffmpeg** 拼接 + 烧字幕 + 9:16 导出 | 本机已有 ffmpeg |

## 3. 本机默认环境变量

```powershell
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CKPT = "RealVisXL_V5.0_fp16.safetensors"
$env:COMFYUI_MAX_SUBJECTS = "characters"   # 或 all
$env:VIDEO_PROVIDER = "wan_local"          # 草稿；成片可改 kling/seedance
```

## 4. 工作流文件

| 文件 | 用途 |
|---|---|
| `workflows/03-assets/character-sheet.api.json` | 角色/场景/道具一致性出图（RealVisXL） |
| `workflows/04-keyframes/keyframe-i2i.api.json` | 关键帧：参考图 + prompt（img2img） |
| `workflows/05-clips/wan-i2v.placeholder.json` | Wan I2V 接入说明/占位（模型下载后替换为可提交 API 图） |

## 5. 不做清单

- 不以 `sd_xl_base` 作为成片风格底模
- 不在未讨论时把 05 锁死为单一云厂商（草稿=本机 Wan；成片再拍板）
- 不伪造未接线平台为「已连接」
