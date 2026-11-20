import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { promisify } from 'node:util';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const catalogPath = path.resolve(rootDir, 'src', 'game', 'spellCatalog.json');
const manifestPath = path.resolve(rootDir, 'data', 'spellAudioManifest.json');
const auditPath = path.resolve(__dirname, 'auditSpellAudio.py');
const runFile = promisify(execFile);
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
  path.resolve(rootDir, '..', 'client', 'public', 'audio', 'spells');
const PUBLIC_AUDIO_BASE_PATH = (process.env.PUBLIC_AUDIO_BASE_PATH || '/audio/spells').replace(
  /\/+$/,
  ''
);
const DIFFICULTY_PREFIX = {
  easy: 'e',
  medium: 'm',
  hard: 'h',
};

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

function formatStableAudioFileName(difficulty, index) {
  const prefix = DIFFICULTY_PREFIX[difficulty];
  if (!prefix) {
    throw new Error(`Unsupported difficulty "${difficulty}" in spell catalog`);
  }
  const id = String(index + 1).padStart(3, '0');
  return `${prefix}${id}.mp3`;
}

function getCatalogTiers(catalog) {
  return Object.entries(catalog).filter(([tier, spells]) => {
    return !tier.startsWith('_') && Array.isArray(spells);
  });
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

async function ensureAudioAuditAvailable() {
  try {
    await runFile('python3', [auditPath, '--check-tools']);
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`Cannot audit new spell audio. Make sure python3 and FFmpeg are on PATH. ${detail}`);
  }
}

async function checkNewClip(filePath) {
  try {
    await runFile('python3', [auditPath, '--clip', filePath]);
    return [];
  } catch (error) {
    if (error.code === 1 && error.stdout?.trim()) {
      return error.stdout.trim().split('\n');
    }
    return [`audio check could not run: ${error.stderr?.trim() || error.message}`];
  }
}

async function main() {
  console.log('Reading spell catalog.');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const manifest = { easy: [], medium: [], hard: [] };
  let auditAvailable = false;
  let flaggedClips = 0;

  await ensureDir(OUTPUT_DIR);
  await ensureDir(path.dirname(manifestPath));

  for (const [difficulty, spells] of getCatalogTiers(catalog)) {
    console.log(`\n=== ${difficulty.toUpperCase()} (${spells.length} spells) ===`);
    for (const [index, spell] of spells.entries()) {
      const fileName = formatStableAudioFileName(difficulty, index);
      const relativeFile = path.join(difficulty, fileName);
      const targetFile = path.join(OUTPUT_DIR, relativeFile);

      await ensureDir(path.dirname(targetFile));

      if (await fileExists(targetFile)) {
        console.log(`✔ Already exists: ${relativeFile}`);
      } else {
        if (!auditAvailable) {
          await ensureAudioAuditAvailable();
          auditAvailable = true;
        }
        try {
          console.log(`↻ Generating: ${relativeFile}`);
          const audioBuffer = await synthesizeSpell(spell);
          await fs.writeFile(targetFile, audioBuffer);
          console.log(`✓ Saved: ${relativeFile}`);
        } catch (error) {
          console.error(`✖ Failed for ${spell}: ${error.message}`);
          continue;
        }
        const issues = await checkNewClip(targetFile);
        if (issues.length) {
          flaggedClips += 1;
          console.warn(`⚠ Review audio for ${spell} (${relativeFile}): ${issues.join(', ')}`);
        } else {
          console.log(`✓ Audio check passed: ${relativeFile}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      manifest[difficulty].push({
        spell,
        audioUrl: `${PUBLIC_AUDIO_BASE_PATH}/${relativeFile.replace(/\\/g, '/')}`,
      });
    }
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`All audio saved under ${OUTPUT_DIR}`);
  if (flaggedClips) {
    console.warn(`Audio review needed for ${flaggedClips} new clip(s). The flagged files were saved. Review them before committing.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
