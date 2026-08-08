# 启动本地 ComfyUI（需已装 conda env comfyui + checkpoint）
$ErrorActionPreference = "Stop"
$ComfyRoot = "E:\ComfyUI"
if (-not (Test-Path "$ComfyRoot\main.py")) { throw "ComfyUI not found at $ComfyRoot" }

$ckpt = Get-ChildItem "$ComfyRoot\models\checkpoints\*.safetensors" -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
if (-not $ckpt) {
  Write-Warning "checkpoints 目录还没有 .safetensors。正在下载的 SDXL 完成后会自动可用。"
} else {
  Write-Host "[comfy] checkpoint: $($ckpt.Name) ($([math]::Round($ckpt.Length/1GB,2)) GB)"
}

# Listen on 8188 for ep01-cli / backend
Set-Location $ComfyRoot
Write-Host "[comfy] starting http://127.0.0.1:8188 ..."
conda run -n comfyui --no-capture-output python main.py --listen 127.0.0.1 --port 8188
