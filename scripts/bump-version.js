#!/usr/bin/env node

/**
 * bump-version.js
 * 
 * Auto-increments the app version across all version files:
 *   - android/app/build.gradle (versionCode & versionName)
 *   - src/config/appVersion.ts  (APP_VERSION constant)
 *   - package.json              (version field)
 * 
 * Usage:
 *   node scripts/bump-version.js          # auto-increment major
 *   node scripts/bump-version.js 8.0.0    # set explicit version
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// --- Helpers ---
function readFile(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}
function writeFile(rel, content) {
  writeFileSync(resolve(ROOT, rel), content, 'utf-8');
}

// --- 1. Read current values from build.gradle ---
const gradlePath = 'android/app/build.gradle';
let gradle = readFile(gradlePath);

const codeMatch = gradle.match(/versionCode\s+(\d+)/);
const nameMatch = gradle.match(/versionName\s+"([^"]+)"/);

if (!codeMatch || !nameMatch) {
  console.error('❌ Could not find versionCode or versionName in build.gradle');
  process.exit(1);
}

const oldCode = parseInt(codeMatch[1], 10);
const oldName = nameMatch[1];

// --- 2. Compute new version ---
let newName;
const explicitVersion = process.argv[2];

if (explicitVersion) {
  // User provided an explicit version
  newName = explicitVersion;
} else {
  // Auto-increment: bump minor version first, rollover to major after .9
  const parts = oldName.split('.').map(Number);
  
  if (parts[1] >= 9) {
    parts[0] += 1; // Major bump (e.g., 7.9.x -> 8.0.0)
    parts[1] = 0;   // Reset minor
  } else {
    parts[1] += 1; // Minor bump (e.g., 7.1.x -> 7.2.0)
  }
  
  parts[2] = 0;   // Always reset patch for this project's convention
  newName = parts.join('.');
}

const newCode = oldCode + 1;

console.log(`\n🔄 Bumping version: ${oldName} (code ${oldCode}) → ${newName} (code ${newCode})\n`);

// --- 3. Update build.gradle ---
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newName}"`);
writeFile(gradlePath, gradle);
console.log(`✅ Updated ${gradlePath}`);

// --- 4. Update src/config/appVersion.ts ---
const appVersionPath = 'src/config/appVersion.ts';
const appVersionContent = `export const APP_VERSION = '${newName}';\n`;
writeFile(appVersionPath, appVersionContent);
console.log(`✅ Updated ${appVersionPath}`);

// --- 5. Update package.json ---
const pkgPath = 'package.json';
const pkg = JSON.parse(readFile(pkgPath));
pkg.version = newName;
writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ Updated ${pkgPath}`);

console.log(`\n🎉 Version bumped to ${newName} (code ${newCode}) successfully!\n`);
console.log('Next steps:');
console.log('  1. Run: vite build && npx cap sync android');
console.log('  2. Build signed APK in Android Studio');
console.log(`  3. Update appVersion to "${newName}" in System Settings (Supabase)\n`);
