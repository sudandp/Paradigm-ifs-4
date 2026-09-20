const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Testing Tesseract in Node...');
  const worker = await createWorker('eng', 1, {
    workerPath: path.resolve(__dirname, '../public/tesseract/worker.min.js'),
    corePath: path.resolve(__dirname, '../public/tesseract/core'),
    langPath: path.resolve(__dirname, '../public/tesseract/tessdata'),
    cachePath: path.resolve(__dirname, '../public/tesseract/tessdata'),
    gzip: false,
  });
  
  const imgPath = path.resolve(__dirname, '../scratch/aadhaar_user.png');
  console.log('Recognizing', imgPath);
  const { data: { text } } = await worker.recognize(imgPath);
  console.log('Text length:', text.length);
  
  await worker.terminate();
}

main().catch(console.error);
