
import { mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');

const sourceDir = path.join(
  frontendDir,
  'node_modules',
  '@vladmandic',
  'face-api',
  'model'
);

const destinationDir = path.join(
  frontendDir,
  'public',
  'models'
);

const modelFiles = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];

async function main() {
  await mkdir(destinationDir, { recursive: true });

  for (const file of modelFiles) {
    const source = path.join(sourceDir, file);
    const destination = path.join(destinationDir, file);

    try {
      await access(source);
      await copyFile(source, destination);
      console.log(`Copied: ${file}`);
    } catch (error) {
      throw new Error(
        `Could not find ${file} in ${sourceDir}. ` +
        'Check that @vladmandic/face-api is installed.'
      );
    }
  }

  console.log('\nAll face recognition models copied successfully.');
}

main().catch((error) => {
  console.error('\nModel setup failed:', error.message);
  process.exitCode = 1;
});
