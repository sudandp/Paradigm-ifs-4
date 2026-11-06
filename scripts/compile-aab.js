#!/usr/bin/env node

/**
 * compile-aab.js
 * 
 * Compiles the Android release App Bundle (.aab) for Google Play Console.
 */

import { spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ANDROID_DIR = resolve(ROOT, 'android');
const AAB_PATH = resolve(ANDROID_DIR, 'app/build/outputs/bundle/release/app-release.aab');

console.log('\n📦 [Compile AAB] Starting Gradle bundleRelease build for Google Play Console...');

const isWin = process.platform === 'win32';
const gradlewCmd = resolve(ANDROID_DIR, isWin ? 'gradlew.bat' : 'gradlew');

const result = spawnSync(`"${gradlewCmd}"`, ['bundleRelease'], {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('\n❌ [Compile AAB] Gradle bundleRelease failed with exit code:', result.status);
  process.exit(result.status || 1);
}

if (existsSync(AAB_PATH)) {
  const stats = statSync(AAB_PATH);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 [Compile AAB] SUCCESS! Production App Bundle is ready for Google Play!`);
  console.log(`📁 AAB Path: ${AAB_PATH} (${sizeMb} MB)`);
  console.log(`🚀 Upload this .aab file directly to Google Play Console:`);
  console.log(`   https://play.google.com/console\n`);
} else {
  console.warn('\n⚠️ [Compile AAB] bundleRelease completed, but app-release.aab was not found at standard path.\n');
}
