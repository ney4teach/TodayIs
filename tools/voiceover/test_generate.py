import tempfile
import unittest
import wave
from pathlib import Path

from generate import MODEL, generate


class VoiceoverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.script = self.root / 'script.txt'
        self.output = self.root / 'output'
        self.audio = self.root / 'source.wav'
        with wave.open(str(self.audio), 'wb') as audio:
            audio.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            audio.writeframes(b'\x00\x00' * 2400)

    def client(self, model=MODEL, result=None):
        audio = str(self.audio)

        class Client:
            config = {'components': [{'props': {'value': f'**Checkpoint:** `{model}`'}}]}
            calls = []

            def predict(self, *args, **kwargs):
                self.calls.append((args, kwargs))
                return result if result is not None else (audio, 'Finished.')

        return Client()

    def test_generates_numbered_wavs_and_manifest_for_utf8_paragraphs(self):
        import json

        self.script.write_text('\ufeffПривет!\nЯ Папик.\n\n\nНовая вкладка.\n', encoding='utf-8')
        client = self.client()
        generate(self.script, self.output, client)
        manifest = json.loads((self.output / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['model'], MODEL)
        self.assertEqual(manifest['speaker'], 'Vivian')
        self.assertEqual([r['text'] for r in manifest['clips']], ['Привет!\nЯ Папик.', 'Новая вкладка.'])
        self.assertEqual([r['file'] for r in manifest['clips']], ['001.wav', '002.wav'])
        self.assertAlmostEqual(manifest['clips'][0]['duration_seconds'], 0.1)
        for clip in manifest['clips']:
            self.assertEqual((self.output / clip['file']).read_bytes(), self.audio.read_bytes())
        self.assertEqual(client.calls[0], (('Привет!\nЯ Папик.', 'Russian', 'Vivian', ''), {'api_name': '/run_instruct'}))

    def test_refuses_empty_script_without_creating_output(self):
        self.script.write_text(' \n\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'пуст'):
            generate(self.script, self.output, self.client())
        self.assertFalse(self.output.exists())

    def test_refuses_different_model_before_generating(self):
        self.script.write_text('Привет!', encoding='utf-8')
        client = self.client('Qwen/another-model')
        with self.assertRaisesRegex(ValueError, 'модель'):
            generate(self.script, self.output, client)
        self.assertFalse(client.calls)
        self.assertFalse(self.output.exists())

    def test_preserves_existing_output(self):
        self.script.write_text('Привет!', encoding='utf-8')
        self.output.mkdir()
        saved = self.output / '001.wav'
        saved.write_bytes(b'existing recording')
        client = self.client()
        with self.assertRaises(FileExistsError):
            generate(self.script, self.output, client)
        self.assertEqual(saved.read_bytes(), b'existing recording')
        self.assertFalse(client.calls)

    def test_reports_generation_error_without_success_manifest(self):
        self.script.write_text('Привет!', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'CUDA out of memory'):
            generate(self.script, self.output, self.client(result=(None, 'CUDA out of memory')))
        self.assertFalse((self.output / 'manifest.json').exists())

    def test_rejects_invalid_audio(self):
        self.script.write_text('Привет!', encoding='utf-8')
        self.audio.write_bytes(b'not a wav')
        with self.assertRaises((EOFError, wave.Error)):
            generate(self.script, self.output, self.client())
        self.assertFalse((self.output / '001.wav').exists())


if __name__ == '__main__':
    unittest.main()
