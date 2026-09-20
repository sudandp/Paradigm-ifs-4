import fs from 'fs';
import path from 'path';
import https from 'https';
import zlib from 'zlib';

const rootDir = process.cwd();
const publicTesseractDir = path.join(rootDir, 'public', 'tesseract');
const coreDir = path.join(publicTesseractDir, 'core');
const tessdataDir = path.join(publicTesseractDir, 'tessdata');

fs.mkdirSync(publicTesseractDir, { recursive: true });
fs.mkdirSync(coreDir, { recursive: true });
fs.mkdirSync(tessdataDir, { recursive: true });

console.log('[1/3] Copying worker.min.js...');
const workerSrc = path.join(rootDir, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, path.join(publicTesseractDir, 'worker.min.js'));
  console.log('✓ Copied worker.min.js');
} else {
  console.error('✗ workerSrc not found:', workerSrc);
}

console.log('[2/3] Copying tesseract.js-core WASM & JS files...');
const coreSrcDir = path.join(rootDir, 'node_modules', 'tesseract.js-core');
if (fs.existsSync(coreSrcDir)) {
  const files = fs.readdirSync(coreSrcDir);
  for (const file of files) {
    if (file.startsWith('tesseract-core') && (file.endsWith('.js') || file.endsWith('.wasm'))) {
      fs.copyFileSync(path.join(coreSrcDir, file), path.join(coreDir, file));
      console.log(`  ✓ Copied core file: ${file}`);
    }
  }
} else {
  console.error('✗ coreSrcDir not found:', coreSrcDir);
}

console.log('[3/3] Downloading eng.traineddata.gz...');
const langGzDest = path.join(tessdataDir, 'eng.traineddata.gz');
const langDest = path.join(tessdataDir, 'eng.traineddata');

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download: status ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const traineddataUrl = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz';

download(traineddataUrl, langGzDest)
  .then(() => {
    console.log('✓ Downloaded eng.traineddata.gz successfully.');
    // Also create uncompressed eng.traineddata
    try {
      const gzipped = fs.readFileSync(langGzDest);
      const unzipped = zlib.gunzipSync(gzipped);
      fs.writeFileSync(langDest, unzipped);
      console.log('✓ Extracted uncompressed eng.traineddata successfully.');
    } catch (gunzipErr) {
      console.warn('! Gunzip warning:', gunzipErr.message);
    }
    console.log('All offline Tesseract assets ready!');
  })
  .catch((err) => {
    console.error('Failed to download traineddata:', err);
    process.exit(1);
  });
