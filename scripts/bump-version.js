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
import { execSync } from 'child_process';
import readline from 'readline';

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

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

const getNotesInteractively = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const lines = [];
  console.log('\n✏️  Enter release notes / update summary (one bullet point per line. Press Enter on an empty line to finish):');
  
  return new Promise((resolve) => {
    rl.setPrompt('> ');
    rl.prompt();
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed === '') {
        rl.close();
        resolve(lines);
      } else {
        lines.push(trimmed);
        rl.prompt();
      }
    });
  });
};

async function main() {
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

  // --- 2b. Gather Git Commits & Prompt for Release Notes ---
  let gitCommits = [];
  try {
    const gitLog = execSync('git log -n 5 --oneline', { encoding: 'utf-8' });
    gitCommits = gitLog.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove hash prefix
        const match = line.match(/^[a-f0-9]+\s+(.*)$/i);
        return match ? match[1] : line;
      });
  } catch (e) {
    console.log('⚠️ Could not fetch git logs. Reverting to empty commit log list.');
  }

  let notes = [];
  if (process.stdin.isTTY) {
    console.log('📝 Recent updates (Git Commits):');
    if (gitCommits.length > 0) {
      gitCommits.forEach((c, idx) => console.log(`  ${idx + 1}. ${c}`));
    } else {
      console.log('  No recent commits found.');
    }

    const useGit = await askQuestion('\n❓ Use these git commits as the update summary? (Y/n): ');
    if (!useGit || useGit.trim().toLowerCase() === 'y') {
      notes = gitCommits.length > 0 ? gitCommits : ['Minor performance updates and bug fixes.'];
    } else {
      notes = await getNotesInteractively();
      if (notes.length === 0) {
        notes = gitCommits.length > 0 ? gitCommits : ['Minor performance updates and bug fixes.'];
      }
    }
  } else {
    // Non-interactive fallback
    console.log('⚠️ Running in non-interactive terminal. Auto-generating release notes from git commits.');
    notes = gitCommits.length > 0 ? gitCommits : ['Minor performance updates and bug fixes.'];
  }

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

  // --- 4b. Write src/config/releaseNotes.ts ---
  const releaseNotesPath = 'src/config/releaseNotes.ts';
  const today = new Date().toISOString().split('T')[0];
  const releaseNotesContent = `export const RELEASE_NOTES = {
  version: '${newName}',
  date: '${today}',
  notes: ${JSON.stringify(notes, null, 2)}
};
`;
  writeFile(releaseNotesPath, releaseNotesContent);
  console.log(`✅ Generated ${releaseNotesPath}`);

  // --- 5. Update package.json ---
  const pkgPath = 'package.json';
  const pkg = JSON.parse(readFile(pkgPath));
  pkg.version = newName;
  writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Updated ${pkgPath}`);

  // --- 6. Update public/version.json ---
  try {
    const versionJsonPath = 'public/version.json';
    const versionData = JSON.parse(readFile(versionJsonPath));
    versionData.latestVersionCode = newCode;
    versionData.latestVersionName = newName;
    versionData.releaseNotes = notes.join('\n');
    writeFile(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n');
    console.log(`✅ Updated ${versionJsonPath}`);
  } catch (e) {
    console.log(`⚠️ Could not update public/version.json: ${e.message}`);
  }

  console.log(`\n🎉 Version bumped to ${newName} (code ${newCode}) successfully!\n`);
  console.log('Next steps:');
  console.log('  1. Run: vite build && npx cap sync android');
  console.log('  2. Build signed APK in Android Studio');
  console.log(`  3. Update appVersion to "${newName}" in System Settings (Supabase)\n`);
}

main().catch(err => {
  console.error('❌ Error bumping version:', err);
  process.exit(1);
});
