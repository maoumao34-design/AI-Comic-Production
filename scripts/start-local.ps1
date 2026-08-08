# 本机一键：后端 + 前端（需已启动 ComfyUI，并设好 COMFYUI_*）
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Resolve-Path "$PSScriptRoot\..").Path }

if (-not $env:COMFYUI_BASE_URL) { $env:COMFYUI_BASE_URL = "http://127.0.0.1:8188" }
if (-not $env:COMFYUI_CKPT) {
  Write-Warning "COMFYUI_CKPT 未设置。请设为 ComfyUI models/checkpoints 下的真实文件名。"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  # winget 安装后新开终端才有 PATH；尝试常见路径
  $candidates = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) {
      $env:Path = "$(Split-Path $c);$env:Path"
      break
    }
  }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "未找到 node。请先安装 Node.js LTS 并重新打开终端。"
}

Write-Host "[start] Node $(node -v) | COMFYUI_BASE_URL=$($env:COMFYUI_BASE_URL) | CKPT=$($env:COMFYUI_CKPT)"

Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory (Join-Path $Root "backend") -WindowStyle Normal
Start-Sleep -Seconds 1
Set-Location (Join-Path $Root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npm run dev
