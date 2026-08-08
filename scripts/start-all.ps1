# 一键启动：ComfyUI + 可视化后端 + 前端
# 用法：在仓库根目录执行  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ComfyRoot = "E:\ComfyUI"
$Py = "$env:USERPROFILE\miniconda3\envs\comfyui\python.exe"

$env:Path = "$env:USERPROFILE\scoop\apps\nodejs-lts\current;$env:USERPROFILE\scoop\shims;$env:Path"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "未找到 Node.js。请先 scoop install nodejs-lts"
}
if (-not (Test-Path $Py)) { throw "未找到 comfyui conda 环境: $Py" }
if (-not (Test-Path "$ComfyRoot\main.py")) { throw "未找到 ComfyUI: $ComfyRoot" }

# 优先 RealVisXL（样片真人风）；否则取最大 safetensors
$preferred = Join-Path $ComfyRoot "models\checkpoints\RealVisXL_V5.0_fp16.safetensors"
$ckpt = if (Test-Path $preferred) {
  Get-Item $preferred
} else {
  Get-ChildItem "$ComfyRoot\models\checkpoints\*.safetensors" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "put_*" } |
    Sort-Object Length -Descending | Select-Object -First 1
}
if (-not $ckpt) { throw "checkpoints 下没有 .safetensors。请下载 RealVisXL_V5.0_fp16.safetensors（见 docs/PRODUCTION-STACK.md）" }

$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CKPT = $ckpt.Name
$env:COMFYUI_ROOT = $ComfyRoot
$env:VIDEO_PROVIDER = "wan_local"
$env:BOOTSTRAP_EP01 = "1"
$env:COMFYUI_MAX_SUBJECTS = "characters"

Write-Host "[start-all] Node=$(node -v) CKPT=$($env:COMFYUI_CKPT)"
Write-Host "[start-all] ComfyUI -> http://127.0.0.1:8188"
Write-Host "[start-all] Backend  -> http://127.0.0.1:8000"
Write-Host "[start-all] Frontend -> http://localhost:5173"
Write-Host "[start-all] 打开网页后选 EP-01，在步骤 03 点 🔄 重生即可出图（默认 4 个角色三视图）"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$ComfyRoot'; & '$Py' main.py --listen 127.0.0.1 --port 8188"
)
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$env:Path='$env:Path'; `$env:COMFYUI_BASE_URL='$($env:COMFYUI_BASE_URL)'; `$env:COMFYUI_CKPT='$($env:COMFYUI_CKPT)'; `$env:BOOTSTRAP_EP01='1'; `$env:COMFYUI_MAX_SUBJECTS='characters'; Set-Location '$Root\backend'; node server.mjs"
)
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$env:Path='$env:Path'; Set-Location '$Root\frontend'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
)

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173/"
