$ErrorActionPreference = 'Stop'
$demo = Join-Path $env:USERPROFILE 'Qwen3-TTS\.venv\Scripts\qwen-tts-demo.exe'
if (!(Test-Path -LiteralPath $demo)) {
    throw "Не найден Qwen: $demo"
}
$env:NO_PROXY = (@($env:NO_PROXY, 'localhost,127.0.0.1,::1') | Where-Object { $_ }) -join ','
& $demo 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice' --device cuda:0 --dtype float32 --no-flash-attn --ip 127.0.0.1 --port 8000
if ($LASTEXITCODE -ne 0) { throw 'Qwen остановился с ошибкой. Подробности указаны выше.' }
