import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sharedDir = path.resolve(rootDir, '..', 'shared');
const catalogPath = path.resolve(rootDir, 'src', 'game', 'spellCatalog.json');
let envPath = path.resolve(rootDir, '.env');

try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: envPath });
} catch {
  console.warn('dotenv not found; make sure ELEVENLABS_* vars are set in your shell.');
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'zNsotODqUhvbJ5wMG7Ei';
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY is missing. Add it to server/.env first.');
  process.exit(1);
}

const OUTPUT_DIR =
  process.env.TTS_OUTPUT_DIR ||
  path.join(os.homedir(), 'Desktop', 'spellcaster-tts');
const PUBLIC_AUDIO_BASE_PATH = (process.env.PUBLIC_AUDIO_BASE_PATH || '/audio/spells').replace(
  /\/+$/,
  ''
);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function slugify(spell) {
  return spell.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function synthesizeSpell(spell) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': API_KEY,
    },
    body: JSON.stringify({
      text: spell,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.8,
        style: 0.75,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

async function main() {
  console.log('Reading spell catalog.');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const manifest = { easy: [], medium: [], hard: [] };

  await ensureDir(OUTPUT_DIR);

  for (const [difficulty, spells] of Object.entries(catalog)) {
    console.log(`\n=== ${difficulty.toUpperCase()} (${spells.length} spells) ===`);
    for (const spell of spells) {
      const slug = slugify(spell);
      const relativeFile = path.join(difficulty, `${slug}.mp3`);
      const targetFile = path.join(OUTPUT_DIR, relativeFile);

      await ensureDir(path.dirname(targetFile));

      if (await fileExists(targetFile)) {
        console.log(`✔ Already exists: ${relativeFile}`);
      } else {
        try {
          console.log(`↻ Generating: ${relativeFile}`);
          const audioBuffer = await synthesizeSpell(spell);
          await fs.writeFile(targetFile, audioBuffer);
          console.log(`✓ Saved: ${relativeFile}`);
          await new Promise((resolve) => setTimeout(resolve, 750));
        } catch (error) {
          console.error(`✖ Failed for ${spell}: ${error.message}`);
          continue;
        }
      }

      manifest[difficulty].push({
        spell,
        file: `${PUBLIC_AUDIO_BASE_PATH}/${relativeFile.replace(/\\/g, '/')}`,
      });
    }
  }

  const manifestPath = path.join(sharedDir, 'spellAudioManifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`All audio saved under ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});