"""Generate Today Is narration using the already running local Qwen demo."""

import argparse
import json
import os
import re
import shutil
import sys
import wave
from datetime import datetime
from pathlib import Path

MODEL = 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice'
SERVER = 'http://127.0.0.1:8000'


def generate(script, output, client):
    text = script.read_text(encoding='utf-8-sig').strip()
    clips = [part.strip() for part in re.split(r'\n\s*\n', text) if part.strip()]
    if not clips:
        raise ValueError('Сценарий пуст. Добавьте реплики, разделённые пустой строкой.')
    checkpoint = f'**Checkpoint:** `{MODEL}`'
    if not any(checkpoint in str(c.get('props', {}).get('value', ''))
               for c in client.config.get('components', [])):
        raise ValueError(f'Запущена другая модель. Нужна {MODEL}.')
    output.mkdir(parents=True, exist_ok=False)
    manifest = {'model': MODEL, 'speaker': 'Vivian', 'language': 'Russian', 'clips': []}
    for index, text in enumerate(clips, 1):
        print(f'Реплика {index}/{len(clips)}...', flush=True)
        audio, status = client.predict(text, 'Russian', 'Vivian', '', api_name='/run_instruct')
        if not audio:
            raise RuntimeError(f'Реплика {index}: {status}')
        with wave.open(str(audio), 'rb') as wav:
            duration = wav.getnframes() / wav.getframerate()
            if not wav.getnframes():
                raise ValueError(f'Реплика {index}: получен пустой WAV.')
        name = f'{index:03}.wav'
        shutil.copyfile(audio, output / name)
        manifest['clips'].append({'file': name, 'text': text, 'duration_seconds': duration})
    (output / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Готово: {output.resolve()}', flush=True)


def main():
    parser = argparse.ArgumentParser(description='Озвучка Today Is: Vivian, русский, Qwen 0.6B.')
    parser.add_argument('script', type=Path, help='Сценарий TXT в UTF-8; одна реплика на абзац.')
    parser.add_argument('--output', type=Path, help='Новая папка для WAV и manifest.json.')
    args = parser.parse_args()
    output = args.output or Path(__file__).parent / 'output' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    os.environ['NO_PROXY'] = ','.join(filter(None, [os.environ.get('NO_PROXY'), 'localhost,127.0.0.1,::1']))
    try:
        from gradio_client import Client

        client = Client(SERVER, verbose=False)
        generate(args.script, output, client)
    except Exception as error:
        print(f'Ошибка: {error}\nПроверьте, что Qwen запущен на {SERVER}.\n'
              'Готовые реплики, если они есть, остались в папке результата.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
