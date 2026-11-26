param(
    [string]$Script = (Join-Path $PSScriptRoot 'sample.txt'),
    [string]$Output
)
$ErrorActionPreference = 'Stop'
$python = Join-Path $env:USERPROFILE 'Qwen3-TTS\.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $python)) {
    throw "Не найден Python Qwen: $python"
}
$arguments = @('-B', '-X', 'utf8', (Join-Path $PSScriptRoot 'generate.py'), $Script)
if ($Output) { $arguments += @('--output', $Output) }
& $python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Озвучка не завершена. Причина указана выше.' }
