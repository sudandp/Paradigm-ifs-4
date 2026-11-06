#!/usr/bin/env node

/**
 * compile-apk.js
 * 
 * Compiles the Android debug APK using Gradle wrapper and reports the output path.
 */

import { spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ANDROID_DIR = resolve(ROOT, 'android');
const APK_PATH = resolve(ANDROID_DIR, 'app/build/outputs/apk/debug/app-debug.apk');

console.log('\n🔨 [Compile APK] Starting Gradle assembleDebug build...');

const isWin = process.platform === 'win32';
const gradlewCmd = resolve(ANDROID_DIR, isWin ? 'gradlew.bat' : 'gradlew');

const result = spawnSync(`"${gradlewCmd}"`, ['assembleDebug'], {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('\n❌ [Compile APK] Gradle build failed with exit code:', result.status);
  process.exit(result.status || 1);
}

if (existsSync(APK_PATH)) {
  const stats = statSync(APK_PATH);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 [Compile APK] SUCCESS!`);
  console.log(`📁 Debug APK: ${APK_PATH} (${sizeMb} MB)`);
  console.log(`📲 Quick install on connected device:`);
  console.log(`   adb install -r android/app/build/outputs/apk/debug/app-debug.apk\n`);
} else {
  console.warn('\n⚠️ [Compile APK] assembleDebug completed, but app-debug.apk was not found at standard path.\n');
}
