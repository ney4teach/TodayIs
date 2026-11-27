# Озвучка роликов Today Is

Локальная генерация реплик Папика: **Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice**, **Vivian**, **Russian**. Один абзац сценария превращается в отдельный WAV. `manifest.json` сохраняет текст, порядок, длительности и выбранный голос для последующего монтажа. Видеомонтаж и анимация в этот инструмент не входят.

## Запуск в Windows

Используется уже установленный Qwen из `%USERPROFILE%\Qwen3-TTS\.venv`. Устанавливать зависимости заново не нужно: `gradio_client` входит в установленный Gradio. Скрипты не меняют это окружение и обращаются только к `http://127.0.0.1:8000`.

1. Откройте PowerShell в папке проекта и запустите сервер (если он уже работает, пропустите этот шаг):

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\voiceover\start-qwen.ps1
   ```

   Оставьте это окно открытым. Параметры сохранены для проверенной GTX 1080 Ti: CUDA, float32, без FlashAttention. Исключение localhost из прокси применяется только к текущему процессу.

2. Во втором окне PowerShell из папки проекта запустите пробную озвучку:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\voiceover\generate.ps1
   ```

   Получите `001.wav`, `002.wav` и `manifest.json` в новой папке внутри `tools\voiceover\output`. Точный путь выводится после завершения.

3. Для своего ролика сохраните TXT в UTF-8. Отделите короткие реплики пустой строкой. Перенос строки внутри абзаца остаётся частью одной реплики. Передайте файл:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\voiceover\generate.ps1 -Script "C:\Videos\TodayIs\script.txt"
   ```

   Можно добавить `-Output "C:\Videos\TodayIs\voice-take-01"`. Папка результата должна быть новой: предыдущие записи не перезаписываются. При ошибке уже сохранённые реплики остаются на месте; итоговый manifest создаётся только после полного успеха. Для повторной попытки выберите новую папку.

Выбор голоса в браузере не влияет на этот инструмент: при каждом запросе передаются Vivian и Russian. Модель проверяется перед генерацией. **0.6B не поддерживает инструкции по стилю**: поле инструкции отправляется пустым. Подачу проверяйте на слух; паузы и пунктуация задаются текстом. Числа, ударения и произношение Today Is прослушивайте перед монтажом.

Модель работает на компьютере автора. GitHub Actions не имеет доступа к его localhost. Озвучка ничего не публикует в Telegram и не отправляет сообщения.

## Проверка

Без загрузки модели и без сети:

```powershell
& "$env:USERPROFILE\Qwen3-TTS\.venv\Scripts\python.exe" -B -X utf8 -m unittest discover -s tools/voiceover -p test_generate.py
```

Полная проверка: при запущенном Qwen выполните пробную озвучку, убедитесь в появлении двух WAV и manifest, прослушайте обе реплики.

Документация: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), [Gradio Python Client](https://www.gradio.app/guides/getting-started-with-the-python-client).
