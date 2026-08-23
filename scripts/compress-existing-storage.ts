import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEFAULT_BUCKETS = [
  'onboarding-documents',
  'avatars',
  'gate-captures',
  'task-attachments',
  'birth-certificates',
  'policies',
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

interface CliArgs {
  bucket?: string;
  thresholdKb: number;
  quality: number;
  maxWidth: number;
  dryRun: boolean;
  limit: number;
}

const argv = yargs(hideBin(process.argv))
  .option('bucket', {
    type: 'string',
    description: 'Specific bucket to process (default: all buckets)',
  })
  .option('threshold-kb', {
    type: 'number',
    default: 350,
    description: 'Skip files smaller than this size in KB',
  })
  .option('quality', {
    type: 'number',
    default: 82,
    description: 'WebP / JPEG quality (1-100)',
  })
  .option('max-width', {
    type: 'number',
    default: 1600,
    description: 'Max image width/height in pixels',
  })
  .option('dry-run', {
    type: 'boolean',
    default: false,
    description: 'Simulate compression without re-uploading',
  })
  .option('limit', {
    type: 'number',
    default: 500,
    description: 'Max files to process per bucket',
  })
  .help()
  .argv as unknown as CliArgs;

function isImageFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function listAllFilesInBucket(bucket: string, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  try {
    const { data: items, error } = await supabase.storage.from(bucket).list(prefix || undefined, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error || !items) {
      return paths;
    }

    for (const item of items) {
      if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      // If item is a folder (id is null or metadata is null/empty)
      if (!item.id || !item.metadata || Object.keys(item.metadata).length === 0) {
        const subPaths = await listAllFilesInBucket(bucket, itemPath);
        paths.push(...subPaths);
      } else {
        if (isImageFilename(item.name)) {
          paths.push(itemPath);
        }
      }
    }
  } catch (err: any) {
    console.warn(`   [${bucket}] Error reading folder "${prefix}":`, err.message);
  }

  return paths;
}

async function run() {
  const bucketsToScan = argv.bucket ? [argv.bucket] : DEFAULT_BUCKETS;

  console.log('===============================================================');
  console.log('🚀 SUPABASE STORAGE IMAGE COMPRESSION OPTIMIZER (SHARP.JS)');
  console.log('===============================================================');
  console.log(`Config: Quality=${argv.quality}, MaxDim=${argv.maxWidth}px, MinSizeThreshold=${argv.thresholdKb}KB, DryRun=${argv.dryRun}`);
  console.log(`Target Buckets: ${bucketsToScan.join(', ')}\n`);

  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;
  let totalFilesProcessed = 0;
  let totalFilesCompressed = 0;
  let totalFilesSkipped = 0;

  for (const bucket of bucketsToScan) {
    console.log(`\n📂 Scanning bucket: [${bucket}]...`);

    let filePaths: string[] = [];
    try {
      filePaths = await listAllFilesInBucket(bucket);
    } catch (e: any) {
      console.warn(`⚠️ Could not list bucket [${bucket}]:`, e.message);
      continue;
    }

    if (filePaths.length === 0) {
      console.log(`   (No image files found in [${bucket}])`);
      continue;
    }

    console.log(`   Found ${filePaths.length} image files in [${bucket}]. Processing...`);

    let bucketProcessed = 0;
    for (const filePath of filePaths) {
      if (bucketProcessed >= argv.limit) {
        console.log(`   Reached limit of ${argv.limit} files for bucket [${bucket}].`);
        break;
      }

      totalFilesProcessed++;
      bucketProcessed++;

      try {
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(filePath);

        if (downloadError || !downloadData) {
          console.warn(`   ⚠️ Failed to download ${filePath}: ${downloadError?.message}`);
          continue;
        }

        const originalBuffer = Buffer.from(await downloadData.arrayBuffer());
        const originalSize = originalBuffer.byteLength;

        // Skip if already below threshold
        if (originalSize < argv.thresholdKb * 1024) {
          totalFilesSkipped++;
          continue;
        }

        totalOriginalBytes += originalSize;

        // Compress with sharp
        const isPng = filePath.toLowerCase().endsWith('.png');
        let pipeline = sharp(originalBuffer, { failOn: 'none' }).rotate();

        pipeline = pipeline.resize({
          width: argv.maxWidth,
          height: argv.maxWidth,
          fit: 'inside',
          withoutEnlargement: true,
        });

        let outputBuffer: Buffer;
        let mimeType = 'image/jpeg';

        if (isPng) {
          outputBuffer = await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
          mimeType = 'image/png';
        } else {
          outputBuffer = await pipeline.jpeg({ quality: argv.quality, progressive: true, mozjpeg: true }).toBuffer();
          mimeType = 'image/jpeg';
        }

        const compressedSize = outputBuffer.byteLength;

        if (compressedSize >= originalSize) {
          // If compression didn't save space, keep original
          totalCompressedBytes += originalSize;
          totalFilesSkipped++;
          console.log(`   ⏭️ [${bucket}] ${filePath}: ${formatBytes(originalSize)} (already optimal)`);
          continue;
        }

        totalCompressedBytes += compressedSize;
        totalFilesCompressed++;

        const savedBytes = originalSize - compressedSize;
        const savedPercent = Math.round((savedBytes / originalSize) * 100);

        console.log(
          `   ✨ [${bucket}] ${filePath}: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (-${savedPercent}%, saved ${formatBytes(savedBytes)})`
        );

        if (!argv.dryRun) {
          // Upload compressed version
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, outputBuffer, {
            contentType: mimeType,
            upsert: true,
          });

          if (uploadError) {
            console.error(`   ❌ Failed to re-upload compressed file ${filePath}:`, uploadError.message);
          } else {
            // Update user_documents file_size if recorded
            await supabase
              .from('user_documents')
              .update({ file_size: compressedSize, updated_at: new Date().toISOString() })
              .eq('path', filePath);
          }
        }
      } catch (err: any) {
        console.error(`   ❌ Error processing ${filePath}:`, err.message);
      }
    }
  }

  const netSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const netSavedPercent = totalOriginalBytes > 0 
    ? Math.round((netSavedBytes / totalOriginalBytes) * 100) 
    : 0;

  console.log('\n===============================================================');
  console.log('📊 COMPRESSION SUMMARY');
  console.log('===============================================================');
  console.log(`Total Image Files Checked : ${totalFilesProcessed}`);
  console.log(`Files Compressed          : ${totalFilesCompressed}`);
  console.log(`Files Skipped (< threshold): ${totalFilesSkipped}`);
  console.log(`Original Total Size       : ${formatBytes(totalOriginalBytes)}`);
  console.log(`Compressed Total Size     : ${formatBytes(totalCompressedBytes)}`);
  console.log(`Total Storage Space Saved : ${formatBytes(netSavedBytes)} (${netSavedPercent}% reduction)`);
  if (argv.dryRun) {
    console.log('\n⚠️ DRY RUN COMPLETED: No files were overwritten in Supabase Storage.');
    console.log('To perform real compression, run without --dry-run:');
    console.log('npx tsx scripts/compress-existing-storage.ts');
  } else {
    console.log('\n✅ COMPRESSION COMPLETE: Supabase Storage files updated!');
  }
}

run().catch(console.error);
