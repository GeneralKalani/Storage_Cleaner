/**
 * ============================================================================
 * STORAGE AUDIT & IN-PLACE CLEANER UTILITY
 * File: storage_audit.js
 * Runtime: Node.js (Modul Bawaan: http, fs, path, crypto, os, child_process)
 * Zero Dependencies - Tidak memerlukan "npm install"
 * Default Target: ./Bahan Latihan P12 (Dukungan input dinamis & upload folder)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const DEFAULT_FOLDER = './Bahan Latihan P12';
const GIANT_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB (STG-03)

/**
 * Format bytes to readable string (B, KB, MB, GB, TB)
 */
function formatBytes(bytes) {
  if (bytes === 0 || bytes === undefined || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format bytes into MB and KB representation (STG-03)
 */
function formatMB_KB(bytes) {
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  const kb = (bytes / 1024).toFixed(0);
  return {
    mb: `${mb} MB`,
    kb: `${Number(kb).toLocaleString()} KB`
  };
}

/**
 * Streaming SHA-256 calculation to handle files of any size safely
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Smart Path Resolver:
 * Resolves full path from folder name, absolute path, quoted path, or home folder
 */
function resolveSmartPath(input) {
  if (!input || typeof input !== 'string') return process.cwd();

  // Strip surrounding quotes and whitespace
  let clean = input.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!clean) return process.cwd();

  // Expand home directory tilde
  if (clean === '~' || clean.startsWith('~\\') || clean.startsWith('~/')) {
    clean = path.join(os.homedir(), clean.slice(1));
  }

  // Normalize single drive letters like "C:" -> "C:\"
  if (/^[a-zA-Z]:$/.test(clean)) {
    clean = clean + path.sep;
  }

  // Absolute path
  if (path.isAbsolute(clean)) {
    return path.normalize(clean);
  }

  // Check if exists relative to current working directory
  const fromCwd = path.resolve(process.cwd(), clean);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  // Check common user directories in Home (Downloads, Desktop, Documents, etc.)
  const home = os.homedir();
  const fromHome = path.resolve(home, clean);
  if (fs.existsSync(fromHome)) {
    return fromHome;
  }

  const commonMap = {
    'downloads': path.join(home, 'Downloads'),
    'download': path.join(home, 'Downloads'),
    'unduhan': path.join(home, 'Downloads'),
    'desktop': path.join(home, 'Desktop'),
    'documents': path.join(home, 'Documents'),
    'dokumen': path.join(home, 'Documents'),
    'pictures': path.join(home, 'Pictures'),
    'gambar': path.join(home, 'Pictures'),
    'videos': path.join(home, 'Videos'),
    'video': path.join(home, 'Videos'),
    'music': path.join(home, 'Music'),
    'musik': path.join(home, 'Music')
  };

  const lower = clean.toLowerCase();
  if (commonMap[lower] && fs.existsSync(commonMap[lower])) {
    return commonMap[lower];
  }

  // Check inside common candidate directories
  const candidateParents = [
    process.cwd(),
    home,
    path.join(home, 'Documents'),
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads')
  ];

  for (const parent of candidateParents) {
    const candidate = path.join(parent, clean);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return fromCwd;
}

/**
 * Get available drive roots on Windows
 */
function getAvailableDrives() {
  const drives = [];
  if (process.platform === 'win32') {
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of letters) {
      const driveRoot = `${letter}:\\`;
      try {
        if (fs.existsSync(driveRoot)) {
          drives.push(driveRoot);
        }
      } catch (e) {}
    }
  } else {
    drives.push('/');
  }
  return drives;
}

/**
 * Browse subdirectories in a target folder
 */
function browseDirectories(targetInput) {
  const resolvedDir = resolveSmartPath(targetInput || process.cwd());
  let subdirs = [];
  let isAccessible = true;
  let errorMsg = null;

  try {
    if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
      const items = fs.readdirSync(resolvedDir, { withFileTypes: true });
      for (const item of items) {
        try {
          if (item.isDirectory()) {
            subdirs.push({
              name: item.name,
              path: path.join(resolvedDir, item.name)
            });
          }
        } catch (e) {}
      }
    } else {
      isAccessible = false;
      errorMsg = 'Folder tidak ditemukan: ' + resolvedDir;
    }
  } catch (err) {
    isAccessible = false;
    errorMsg = err.message;
  }

  subdirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const home = os.homedir();
  const drives = getAvailableDrives();

  return {
    currentPath: resolvedDir,
    parentPath: path.dirname(resolvedDir) !== resolvedDir ? path.dirname(resolvedDir) : null,
    isAccessible: isAccessible,
    errorMessage: errorMsg,
    subdirectories: subdirs,
    drives: drives,
    quickShortcuts: [
      { name: 'Bahan Latihan P12', path: path.resolve(process.cwd(), 'Bahan Latihan P12') },
      { name: 'Downloads', path: path.join(home, 'Downloads') },
      { name: 'Desktop', path: path.join(home, 'Desktop') },
      { name: 'Documents', path: path.join(home, 'Documents') },
      { name: 'Pictures', path: path.join(home, 'Pictures') },
      { name: 'Videos', path: path.join(home, 'Videos') },
      { name: 'Folder Kerja (CWD)', path: process.cwd() }
    ].filter(s => {
      try { return fs.existsSync(s.path); } catch(e) { return false; }
    })
  };
}

/**
 * Recursively scan directory and collect file paths
 */
function getFilesRecursively(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      try {
        if (item.isDirectory()) {
          results = results.concat(getFilesRecursively(fullPath));
        } else if (item.isFile()) {
          results.push(fullPath);
        }
      } catch (err) {
        console.warn(`[WARN] Skipping inaccessible item: ${fullPath} (${err.message})`);
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to read directory: ${dir} (${err.message})`);
  }
  return results;
}

/**
 * Perform storage audit for a target directory (STG-01, STG-02, STG-03)
 */
async function auditStorage(targetDirInput, thresholdBytes = GIANT_THRESHOLD_BYTES) {
  const resolvedTarget = resolveSmartPath(targetDirInput);

  if (!fs.existsSync(resolvedTarget)) {
    const normalizedDefault = path.resolve(process.cwd(), DEFAULT_FOLDER);
    if (resolvedTarget === normalizedDefault || targetDirInput === DEFAULT_FOLDER || targetDirInput === 'Bahan Latihan P12') {
      seedSampleFolder(resolvedTarget);
    } else {
      throw new Error(`Folder tidak ditemukan: "${resolvedTarget}". Pastikan folder atau path sudah benar.`);
    }
  }

  const stat = fs.statSync(resolvedTarget);
  if (!stat.isDirectory()) {
    throw new Error(`Path bukan sebuah folder: "${resolvedTarget}"`);
  }

  const filePaths = getFilesRecursively(resolvedTarget);
  const filesMetadata = [];
  const hashMap = new Map();
  let totalBytes = 0;
  let tmpFilesCount = 0;
  let tmpFilesBytes = 0;
  const tmpFilesList = [];

  for (const filePath of filePaths) {
    try {
      const fileStat = fs.statSync(filePath);
      const size = fileStat.size;
      const fileName = path.basename(filePath);
      const isTmp = fileName.toLowerCase().endsWith('.tmp');

      totalBytes += size;
      if (isTmp) {
        tmpFilesCount++;
        tmpFilesBytes += size;
        tmpFilesList.push({
          name: fileName,
          absolutePath: filePath,
          relativePath: path.relative(resolvedTarget, filePath),
          size: size,
          sizeFormatted: formatBytes(size)
        });
      }

      // Calculate SHA-256 (STG-01)
      const sha256 = await calculateFileHash(filePath);
      const mbKb = formatMB_KB(size);

      const fileObj = {
        name: fileName,
        absolutePath: filePath,
        relativePath: path.relative(resolvedTarget, filePath),
        size: size,
        sizeFormatted: formatBytes(size),
        sizeMB: mbKb.mb,
        sizeKB: mbKb.kb,
        hash: sha256,
        isGiant: size >= thresholdBytes,
        isTmp: isTmp,
        mtime: fileStat.mtime
      };

      filesMetadata.push(fileObj);

      if (!hashMap.has(sha256)) {
        hashMap.set(sha256, []);
      }
      hashMap.get(sha256).push(fileObj);
    } catch (err) {
      console.warn(`[WARN] Gagal membaca metadata file: ${filePath} (${err.message})`);
    }
  }

  // Duplicate detection (STG-02)
  const duplicateGroups = [];
  let potentialDuplicateSavings = 0;
  let duplicateCopiesCount = 0;

  for (const [hash, group] of hashMap.entries()) {
    if (group.length > 1) {
      // Sort: pick master/original as shortest path or oldest creation time
      group.sort((a, b) => {
        if (a.relativePath.length !== b.relativePath.length) {
          return a.relativePath.length - b.relativePath.length;
        }
        return new Date(a.mtime) - new Date(b.mtime);
      });

      const original = group[0];
      const duplicates = group.slice(1);
      const groupFileSize = original.size;
      const groupWastedBytes = groupFileSize * duplicates.length;

      potentialDuplicateSavings += groupWastedBytes;
      duplicateCopiesCount += duplicates.length;

      duplicateGroups.push({
        hash: hash,
        fileCount: group.length,
        singleSize: groupFileSize,
        singleSizeFormatted: formatBytes(groupFileSize),
        wastedBytes: groupWastedBytes,
        wastedFormatted: formatBytes(groupWastedBytes),
        original: {
          ...original,
          isKept: true
        },
        copies: duplicates.map(d => ({
          ...d,
          isKept: false
        }))
      });
    }
  }

  // Sort duplicate groups by wasted bytes descending (Top 20 per STG-02)
  duplicateGroups.sort((a, b) => b.wastedBytes - a.wastedBytes);
  const top20Duplicates = duplicateGroups.slice(0, 20);

  // Giant File Flagging (STG-03: threshold 5GB, list 15 giant files with size in MB/KB)
  const giantFiles = filesMetadata
    .filter(f => f.isGiant)
    .sort((a, b) => b.size - a.size);

  // Top 15 largest files overall
  const top15Largest = [...filesMetadata]
    .sort((a, b) => b.size - a.size)
    .slice(0, 15)
    .map((f, idx) => ({
      rank: idx + 1,
      name: f.name,
      absolutePath: f.absolutePath,
      relativePath: f.relativePath,
      size: f.size,
      sizeFormatted: formatBytes(f.size),
      sizeMB: f.sizeMB,
      sizeKB: f.sizeKB,
      isGiant: f.isGiant
    }));

  const totalPotentialSavings = potentialDuplicateSavings + tmpFilesBytes;

  return {
    targetDir: resolvedTarget,
    metrics: {
      totalFiles: filesMetadata.length,
      totalCapacityBytes: totalBytes,
      totalCapacityFormatted: formatBytes(totalBytes),
      giantFilesCount: giantFiles.length,
      giantFilesBytes: giantFiles.reduce((acc, f) => acc + f.size, 0),
      giantFilesFormatted: formatBytes(giantFiles.reduce((acc, f) => acc + f.size, 0)),
      duplicateGroupsCount: duplicateGroups.length,
      duplicateCopiesCount: duplicateCopiesCount,
      potentialDuplicateSavings: potentialDuplicateSavings,
      potentialDuplicateSavingsFormatted: formatBytes(potentialDuplicateSavings),
      tmpFilesCount: tmpFilesCount,
      tmpFilesBytes: tmpFilesBytes,
      tmpFilesFormatted: formatBytes(tmpFilesBytes),
      totalPotentialSavings: totalPotentialSavings,
      totalPotentialSavingsFormatted: formatBytes(totalPotentialSavings),
      giantThresholdGB: 5
    },
    top20Duplicates: top20Duplicates,
    allDuplicateGroupsCount: duplicateGroups.length,
    giantFiles: giantFiles.slice(0, 15).map((f, idx) => ({
      rank: idx + 1,
      name: f.name,
      absolutePath: f.absolutePath,
      relativePath: f.relativePath,
      size: f.size,
      sizeFormatted: formatBytes(f.size),
      sizeMB: f.sizeMB,
      sizeKB: f.sizeKB
    })),
    top15Largest: top15Largest,
    tmpFiles: tmpFilesList
  };
}

/**
 * Direct In-Place Cleanup (STG-05)
 * Deletes duplicate copies (preserving 1 master) and .tmp files in-place.
 */
async function performCleanup(targetDirInput) {
  const resolvedTarget = resolveSmartPath(targetDirInput);
  const auditResult = await auditStorage(resolvedTarget);
  const deletedFiles = [];
  const errors = [];
  let freedBytes = 0;

  // 1. Delete duplicate copies (keeping original)
  for (const group of auditResult.top20Duplicates) {
    for (const copy of group.copies) {
      try {
        if (fs.existsSync(copy.absolutePath)) {
          fs.unlinkSync(copy.absolutePath);
          deletedFiles.push({
            path: copy.absolutePath,
            name: copy.name,
            size: copy.size,
            sizeFormatted: copy.sizeFormatted,
            type: 'Duplikat (Salinan Tambahan)'
          });
          freedBytes += copy.size;
        }
      } catch (err) {
        errors.push(`Gagal menghapus ${copy.absolutePath}: ${err.message}`);
      }
    }
  }

  // 2. Delete .tmp files
  for (const tmp of auditResult.tmpFiles) {
    if (deletedFiles.some(d => d.path === tmp.absolutePath)) continue;
    try {
      if (fs.existsSync(tmp.absolutePath)) {
        fs.unlinkSync(tmp.absolutePath);
        deletedFiles.push({
          path: tmp.absolutePath,
          name: tmp.name,
          size: tmp.size,
          sizeFormatted: tmp.sizeFormatted,
          type: 'Berkas Sampah Sementara (.tmp)'
        });
        freedBytes += tmp.size;
      }
    } catch (err) {
      errors.push(`Gagal menghapus ${tmp.absolutePath}: ${err.message}`);
    }
  }

  return {
    success: true,
    targetDir: auditResult.targetDir,
    deletedCount: deletedFiles.length,
    freedBytes: freedBytes,
    freedFormatted: formatBytes(freedBytes),
    deletedFiles: deletedFiles,
    errors: errors
  };
}

/**
 * Seed dummy demo files in ./Bahan Latihan P12
 */
function seedSampleFolder(targetDirInput) {
  const targetDir = resolveSmartPath(targetDirInput);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const subDir1 = path.join(targetDir, 'Dokumen Proyek');
  const subDir2 = path.join(targetDir, 'Backup Data');
  const subDir3 = path.join(targetDir, 'Media & Aset');
  const subDir4 = path.join(targetDir, 'Temp Cache');

  [subDir1, subDir2, subDir3, subDir4].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const samplePdfContent = Buffer.from('PDF-1.7 %SAMPLE SPECIFICATION DOCUMENT FOR STORAGE AUDIT% ' + 'A'.repeat(50000));
  const sampleBackupContent = Buffer.from(samplePdfContent);
  const sampleArchiveContent = Buffer.from('ZIP-ARCHIVE-PAYLOAD-HEADER-CHUNK ' + 'B'.repeat(120000));
  const sampleDuplicateArchive = Buffer.from(sampleArchiveContent);
  const sampleImageContent = Buffer.from('PNG-HEADER-SAMPLE-ASSET-BANNER ' + 'C'.repeat(75000));
  const sampleImageDuplicate = Buffer.from(sampleImageContent);

  const filesToCreate = [
    { p: path.join(targetDir, 'modul.pdf'), content: samplePdfContent },
    { p: path.join(subDir2, 'modul_BACKUP.pdf'), content: sampleBackupContent },
    { p: path.join(subDir1, 'modul_FINAL_v2.pdf'), content: sampleBackupContent },
    { p: path.join(targetDir, 'archive_januari.zip'), content: sampleArchiveContent },
    { p: path.join(subDir2, 'archive_januari_copy.zip'), content: sampleDuplicateArchive },
    { p: path.join(subDir3, 'banner_hero.png'), content: sampleImageContent },
    { p: path.join(subDir1, 'banner_hero_unused.png'), content: sampleImageDuplicate },
    { p: path.join(subDir4, 'build_cache_001.tmp'), content: Buffer.from('TEMP LOG DATA ' + 'X'.repeat(30000)) },
    { p: path.join(subDir4, 'session_dump.tmp'), content: Buffer.from('TEMP DUMP DATA ' + 'Y'.repeat(45000)) },
    { p: path.join(targetDir, 'scratchpad.tmp'), content: Buffer.from('TMP WORK ' + 'Z'.repeat(15000)) },
    { p: path.join(subDir1, 'laporan_tahunan.docx'), content: Buffer.from('DOCX CONTENT ' + 'D'.repeat(60000)) },
    { p: path.join(subDir3, 'database_dump.sql'), content: Buffer.from('SQL DUMP ' + 'E'.repeat(150000)) }
  ];

  let createdCount = 0;
  for (const item of filesToCreate) {
    fs.writeFileSync(item.p, item.content);
    createdCount++;
  }

  return {
    success: true,
    folder: targetDir,
    createdFiles: createdCount
  };
}

/**
 * Modern Responsive Dashboard HTML
 */
function getHtmlContent() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storage Audit & In-Place Cleaner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #090d16;
      --bg-card: rgba(18, 24, 38, 0.75);
      --bg-card-hover: rgba(26, 35, 55, 0.85);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-hover: rgba(99, 102, 241, 0.35);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-primary: #6366f1;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-rose: #f43f5e;
      --accent-amber: #f59e0b;
      --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(6, 182, 212, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.5;
      padding: 2rem 1.5rem 4rem;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1.5rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    .logo-area { display: flex; align-items: center; gap: 1rem; }

    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-cyan));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
    }

    .logo-text h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #fff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-text p { color: var(--text-muted); font-size: 0.85rem; }

    .header-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .pill-badge {
      font-size: 0.75rem;
      font-family: var(--font-mono);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .pill-badge.active {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 8px #10b981;
    }

    /* CONTROLS CARD */
    .controls-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .scan-form { display: flex; flex-direction: column; gap: 1rem; }

    .input-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }

    .input-wrapper { flex: 1; position: relative; min-width: 280px; }

    .input-wrapper input {
      width: 100%;
      background: rgba(10, 15, 25, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.85rem 1rem 0.85rem 2.75rem;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s ease;
    }

    .input-wrapper input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .input-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 1.1rem;
      pointer-events: none;
    }

    button {
      cursor: pointer;
      font-family: var(--font-sans);
      font-weight: 600;
      border: none;
      border-radius: 10px;
      padding: 0.85rem 1.4rem;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent-primary), #4f46e5);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }

    .btn-upload {
      background: linear-gradient(135deg, var(--accent-cyan), #0284c7);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
    }

    .btn-upload:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-main);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-danger {
      background: linear-gradient(135deg, var(--accent-rose), #e11d48);
      color: #fff;
      box-shadow: 0 4px 14px rgba(244, 63, 94, 0.35);
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(244, 63, 94, 0.5);
    }

    button:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

    /* UPLOAD DROPZONE BANNER */
    .dropzone-banner {
      border: 2px dashed rgba(6, 182, 212, 0.35);
      border-radius: 12px;
      padding: 1.25rem;
      background: rgba(6, 182, 212, 0.04);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      transition: all 0.2s ease;
    }

    .dropzone-banner.drag-over {
      background: rgba(6, 182, 212, 0.12);
      border-color: var(--accent-cyan);
      transform: scale(1.005);
    }

    .dropzone-text {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .dropzone-icon {
      font-size: 1.75rem;
    }

    .dropzone-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: #fff;
    }

    .dropzone-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .quick-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .quick-link {
      background: transparent;
      border: 1px dashed var(--border-color);
      color: var(--text-muted);
      padding: 0.35rem 0.65rem;
      font-size: 0.78rem;
      border-radius: 6px;
      cursor: pointer;
    }

    .quick-link:hover {
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }

    /* STATUS MESSAGE */
    #scanStatusMsg {
      font-size: 0.82rem;
      font-family: var(--font-mono);
      padding: 0.6rem 0.9rem;
      border-radius: 8px;
      display: none;
      line-height: 1.4;
    }

    /* METRIC CARDS (STG-04) */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.25rem;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .metric-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-3px);
      background: var(--bg-card-hover);
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--card-accent, var(--accent-primary));
    }

    .metric-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .metric-title {
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .metric-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      background: rgba(255, 255, 255, 0.05);
      color: var(--card-accent, #fff);
    }

    .metric-value {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
      margin-bottom: 0.25rem;
    }

    .metric-sub { font-size: 0.8rem; color: var(--text-muted); }

    /* ACTION BAR */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      background: rgba(244, 63, 94, 0.08);
      border: 1px solid rgba(244, 63, 94, 0.25);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
    }

    .action-info h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
    }

    .action-info p { font-size: 0.85rem; color: #fca5a5; }

    /* SECTION CONTAINERS */
    .section-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-badge {
      font-size: 0.75rem;
      font-family: var(--font-mono);
      background: rgba(255, 255, 255, 0.08);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      color: var(--text-muted);
    }

    .content-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    /* TABLES (STG-03) */
    .table-responsive { overflow-x: auto; border-radius: 10px; }

    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }

    th {
      background: rgba(255, 255, 255, 0.04);
      padding: 0.85rem 1rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .file-path {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--text-muted);
      max-width: 420px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge-giant {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      font-family: var(--font-mono);
      background: rgba(244, 63, 94, 0.18);
      color: #fda4af;
      border: 1px solid rgba(244, 63, 94, 0.35);
    }

    .badge-normal {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      font-family: var(--font-mono);
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
    }

    /* ACCORDION (STG-02) */
    .accordion-item {
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 0.75rem;
      overflow: hidden;
      background: rgba(10, 15, 25, 0.6);
      transition: all 0.2s ease;
    }

    .accordion-item:hover { border-color: rgba(99, 102, 241, 0.3); }

    .accordion-header {
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.02);
      user-select: none;
    }

    .accordion-header:hover { background: rgba(255, 255, 255, 0.04); }

    .accordion-title { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

    .accordion-hash {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.06);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      color: var(--accent-cyan);
    }

    .accordion-meta { display: flex; align-items: center; gap: 1rem; font-size: 0.85rem; color: var(--text-muted); }

    .accordion-chevron { transition: transform 0.2s ease; font-size: 0.8rem; color: var(--text-muted); }

    .accordion-item.open .accordion-chevron { transform: rotate(180deg); }

    .accordion-body {
      display: none;
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border-color);
      background: rgba(0, 0, 0, 0.2);
    }

    .accordion-item.open .accordion-body { display: block; }

    .file-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0.85rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-size: 0.82rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid transparent;
    }

    .file-row.original {
      border-color: rgba(16, 185, 129, 0.25);
      background: rgba(16, 185, 129, 0.05);
    }

    .file-row.duplicate {
      border-color: rgba(244, 63, 94, 0.2);
      background: rgba(244, 63, 94, 0.03);
    }

    .status-tag {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: var(--font-mono);
    }

    .status-tag.keep { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-tag.delete { background: rgba(244, 63, 94, 0.2); color: #f87171; }

    /* MODAL */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.5rem;
    }

    .modal-overlay.active { display: flex; }

    .modal-box {
      background: #0d121f;
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 20px;
      width: 100%;
      max-width: 650px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.25rem;
      line-height: 1;
    }

    .modal-close:hover { color: #fff; }

    .modal-body { padding: 1.5rem; overflow-y: auto; font-size: 0.9rem; }

    .modal-alert {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.25);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;
      color: #fda4af;
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .modal-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .summary-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.85rem;
    }

    .summary-item .label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }
    .summary-item .val { font-size: 1.15rem; font-weight: 700; color: #fff; margin-top: 0.2rem; }

    .files-preview-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      font-family: var(--font-mono);
      font-size: 0.78rem;
    }

    .preview-file-item {
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      justify-content: space-between;
      color: #cbd5e1;
    }

    .preview-file-item:last-child { border-bottom: none; }

    .modal-footer {
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 0 0 20px 20px;
    }

    /* DIRECTORY BROWSE ITEMS */
    .folder-grid-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      margin-bottom: 0.35rem;
      transition: all 0.15s ease;
      font-size: 0.85rem;
    }

    .folder-grid-item:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.35);
      transform: translateX(4px);
    }

    .folder-grid-item .folder-name {
      font-weight: 600;
      color: #fff;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-state { text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); }
    .empty-state-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.6; }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      color: #fff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      display: none;
      align-items: center;
      gap: 0.75rem;
      z-index: 9999;
      animation: slideUp 0.3s ease;
      font-size: 0.88rem;
    }

    .toast.success { border-color: rgba(16, 185, 129, 0.4); background: #064e3b; }
    .toast.error { border-color: rgba(244, 63, 94, 0.4); background: #4c0519; }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- HEADER -->
    <header>
      <div class="logo-area">
        <div class="logo-icon">💾</div>
        <div class="logo-text">
          <h1>Storage Audit & Cleaner</h1>
          <p>Inspeksi Penyimpanan, Deteksi Duplikat SHA-256 & Pembersihan In-Place</p>
        </div>
      </div>
      <div class="header-badges">
        <span class="pill-badge active"><span class="dot"></span> Node.js Native Runtime</span>
        <span class="pill-badge">Zero Dependency</span>
        <span class="pill-badge">Port: 3000</span>
      </div>
    </header>

    <!-- CONTROLS CARD -->
    <section class="controls-card">
      <form class="scan-form" id="scanForm" onsubmit="event.preventDefault(); startScan();">
        
        <!-- FOLDER UPLOAD / DRAG & DROP BANNER -->
        <div class="dropzone-banner" id="dropzoneBanner">
          <div class="dropzone-text">
            <span class="dropzone-icon">📂</span>
            <div>
              <div class="dropzone-title">Upload / Pilih Folder Secara Langsung</div>
              <div class="dropzone-desc">Pilih folder dari komputer Anda tanpa perlu mengetik path manual (atau drag & drop folder ke sini)</div>
            </div>
          </div>
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <!-- Hidden native HTML5 folder picker input -->
            <input type="file" id="folderUploadInput" webkitdirectory directory multiple style="display: none;">
            <button type="button" class="btn-upload" id="btnUploadFolder" onclick="triggerFolderUpload()">
              <span>📁 Upload / Pilih Folder</span>
            </button>
            <button type="button" class="btn-secondary" id="btnBrowseModal" onclick="openBrowseModal()">
              <span>🗂️ Jelajahi Komputer</span>
            </button>
          </div>
        </div>

        <!-- INPUT PATH & PINDAI BUTTON -->
        <div class="input-row">
          <div class="input-wrapper">
            <span class="input-icon">📁</span>
            <input type="text" id="targetPath" list="folderSuggestions" placeholder="Ketik nama folder atau path (contoh: Downloads, Desktop, C:\\, ./Bahan Latihan P12)" value="./Bahan Latihan P12" required>
            <datalist id="folderSuggestions">
              <option value="./Bahan Latihan P12">Folder Latihan Default</option>
              <option value="Downloads">Folder Unduhan (Downloads)</option>
              <option value="Desktop">Folder Desktop</option>
              <option value="Documents">Folder Dokumen (Documents)</option>
              <option value="Pictures">Folder Gambar (Pictures)</option>
              <option value="Videos">Folder Video (Videos)</option>
              <option value="C:\\">Drive C:\\</option>
              <option value=".">Folder Project Saat Ini</option>
            </datalist>
          </div>
          <button type="submit" class="btn-primary" id="btnScan">
            <span id="btnScanIcon">🔍</span>
            <span id="btnScanText">Pindai Folder</span>
          </button>
        </div>

        <!-- STATUS FEEDBACK -->
        <div id="scanStatusMsg"></div>

        <!-- QUICK CHIPS -->
        <div class="quick-actions">
          <span>Pintasan Cepat:</span>
          <button type="button" class="quick-link" onclick="setFolderPath('./Bahan Latihan P12')">📁 Bahan Latihan P12</button>
          <button type="button" class="quick-link" onclick="setFolderPath('Downloads')">📥 Downloads</button>
          <button type="button" class="quick-link" onclick="setFolderPath('Desktop')">💻 Desktop</button>
          <button type="button" class="quick-link" onclick="setFolderPath('Documents')">📄 Documents</button>
          <button type="button" class="quick-link" onclick="setFolderPath('Pictures')">🖼️ Pictures</button>
          <button type="button" class="quick-link" onclick="setFolderPath('Videos')">🎬 Videos</button>
          <button type="button" class="quick-link" onclick="setFolderPath('C:/')">💽 Drive C:\</button>
          <button type="button" class="quick-link" onclick="setFolderPath('.')">🏢 Workspace</button>
          <button type="button" class="quick-link" onclick="createSampleFolder()">+ Buat Sampel Uji Demo</button>
        </div>
      </form>
    </section>

    <!-- METRICS CARDS (STG-04) -->
    <section class="metrics-grid">
      <div class="metric-card" style="--card-accent: var(--accent-primary);">
        <div class="metric-top">
          <span class="metric-title">Total File</span>
          <div class="metric-icon">📄</div>
        </div>
        <div class="metric-value" id="valTotalFiles">-</div>
        <div class="metric-sub" id="subTotalFiles">Seluruh file dalam folder & subfolder</div>
      </div>

      <div class="metric-card" style="--card-accent: var(--accent-cyan);">
        <div class="metric-top">
          <span class="metric-title">Total Kapasitas</span>
          <div class="metric-icon">📊</div>
        </div>
        <div class="metric-value" id="valTotalCapacity">-</div>
        <div class="metric-sub" id="subTotalCapacity">Ukuran kumulatif file dipindai</div>
      </div>

      <!-- File Raksasa (STG-03: threshold 5GB) -->
      <div class="metric-card" style="--card-accent: var(--accent-amber);">
        <div class="metric-top">
          <span class="metric-title">File Raksasa (&gt;5GB)</span>
          <div class="metric-icon">⚠️</div>
        </div>
        <div class="metric-value" id="valGiantFiles">-</div>
        <div class="metric-sub" id="subGiantFiles">Ambang batas: &ge; 5 GB (STG-03)</div>
      </div>

      <div class="metric-card" style="--card-accent: var(--accent-emerald);">
        <div class="metric-top">
          <span class="metric-title">Potensi Hemat</span>
          <div class="metric-icon">✨</div>
        </div>
        <div class="metric-value" id="valSavings">-</div>
        <div class="metric-sub" id="subSavings">Dari duplikat identik & berkas .tmp</div>
      </div>
    </section>

    <!-- ACTION CLEANUP BAR (STG-05) -->
    <section class="action-bar" id="actionBar" style="display: none;">
      <div class="action-info">
        <h3>🧹 Pembersihan Langsung Di Tempat (In-Place Cleanup)</h3>
        <p id="actionSubtitle">Ditemukan file duplikat dan berkas sampah sementara (.tmp) yang dapat dibersihkan langsung.</p>
      </div>
      <button class="btn-danger" id="btnOpenModal" onclick="openCleanupModal()">
        <span>🗑️ Bersihkan Duplikat & Sampah</span>
      </button>
    </section>

    <!-- GIANT FILES TABLE (STG-03: 15 Files, size in MB & KB) -->
    <section class="content-card">
      <div class="section-title">
        <span>🐘 Daftar File Raksasa & Peringkat Ukuran Teratas (Top 15)</span>
        <span class="section-badge" id="giantBadge">Threshold: &ge; 5 GB | Ukuran: MB & KB</span>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Nama File</th>
              <th>Lokasi Path File</th>
              <th>Ukuran (MB / KB)</th>
              <th style="width: 150px;">Status Flag</th>
            </tr>
          </thead>
          <tbody id="giantTableBody">
            <tr>
              <td colspan="5" class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div>Belum ada folder yang dipindai. Masukkan path folder atau klik "Upload / Pilih Folder".</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- DUPLICATE GROUPS ACCORDION (STG-02) -->
    <section class="content-card">
      <div class="section-title">
        <span>👯 Kelompok File Duplikat SHA-256 (Top 20 Grup)</span>
        <span class="section-badge" id="dupBadge">Identik Isi (Hash Persis)</span>
      </div>
      <div id="duplicateAccordion">
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <div>Belum ada data kelompok duplikat.</div>
        </div>
      </div>
    </section>
  </div>

  <!-- CONFIRMATION CLEANUP MODAL (STG-05) -->
  <div class="modal-overlay" id="cleanupModal">
    <div class="modal-box">
      <div class="modal-header">
        <h3>⚠️ Konfirmasi Pembersihan In-Place</h3>
        <button class="modal-close" onclick="closeCleanupModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-alert">
          <strong>Perhatian:</strong> Pembersihan ini berdampak <u>langsung pada folder target</u> yang dipindai (eksekusi langsung di tempat / in-place, tanpa membuat salinan baru). File salinan kembar dan file <code>.tmp</code> akan dihapus secara permanen, dan <strong>1 file asli per kelompok akan tetap dipertahankan</strong>.
        </div>

        <div class="modal-summary-grid">
          <div class="summary-item">
            <div class="label">Salinan Duplikat Dihapus</div>
            <div class="val" id="modalDupCopiesCount">0 file</div>
          </div>
          <div class="summary-item">
            <div class="label">Berkas .TMP Sampah</div>
            <div class="val" id="modalTmpCount">0 file</div>
          </div>
          <div class="summary-item">
            <div class="label">Total Ruang Dibereskan</div>
            <div class="val" style="color: #34d399;" id="modalFreedBytes">0 B</div>
          </div>
          <div class="summary-item">
            <div class="label">File Asli Dipertahankan</div>
            <div class="val" style="color: #60a5fa;" id="modalKeptCount">0 file</div>
          </div>
        </div>

        <div style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.5rem; color: var(--text-muted);">
          Daftar Berkas Yang Akan Dihapus:
        </div>
        <div class="files-preview-list" id="modalFilesPreview"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeCleanupModal()">Batal</button>
        <button class="btn-danger" id="btnConfirmDelete" onclick="executeCleanup()">
          <span id="btnDeleteText">Konfirmasi Hapus Sekarang</span>
        </button>
      </div>
    </div>
  </div>

  <!-- DIRECTORY BROWSE MODAL -->
  <div class="modal-overlay" id="browseModal">
    <div class="modal-box" style="max-width: 750px;">
      <div class="modal-header">
        <h3>🗂️ Jelajahi & Pilih Folder di Komputer</h3>
        <button class="modal-close" onclick="closeBrowseModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Pintasan Cepat Drive & Lokasi:</div>
        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;" id="quickBrowseShortcuts"></div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <button type="button" class="btn-secondary" id="btnBrowseUp" onclick="browseUpDirectory()" style="padding: 0.5rem 0.85rem;" title="Naik satu tingkat">
            ⬆️ Naik
          </button>
          <input type="text" id="browseCurrentPathInput" style="flex: 1; background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem 0.85rem; color: #fff; font-family: var(--font-mono); font-size: 0.82rem;" onkeydown="if(event.key==='Enter') loadBrowseDirectory(this.value)">
          <button type="button" class="btn-secondary" onclick="loadBrowseDirectory(document.getElementById('browseCurrentPathInput').value)" style="padding: 0.5rem 0.85rem;">
            Buka
          </button>
        </div>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 10px; padding: 0.5rem; background: rgba(0, 0, 0, 0.25);" id="browseFolderList"></div>
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        <span style="font-size: 0.8rem; color: var(--text-muted); align-self: center;" id="browseFolderCount">0 subfolder</span>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-secondary" onclick="closeBrowseModal()">Tutup</button>
          <button class="btn-primary" onclick="selectCurrentBrowseFolder()">
            ✅ Pilih & Pindai Folder Ini
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- TOAST NOTIFICATION -->
  <div class="toast" id="toast">
    <span id="toastIcon">ℹ️</span>
    <span id="toastMsg">Pesan</span>
  </div>

  <script>
    let currentAuditData = null;
    let currentBrowsePath = '';
    let currentBrowseParent = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showToast(msg, type = 'info') {
      const toast = document.getElementById('toast');
      const icon = document.getElementById('toastIcon');
      const text = document.getElementById('toastMsg');
      toast.className = 'toast ' + type;
      icon.textContent = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
      text.textContent = msg;
      toast.style.display = 'flex';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 4500);
    }

    function setFolderPath(pathVal) {
      document.getElementById('targetPath').value = pathVal;
      startScan();
    }

    /* TRIGGER FOLDER UPLOAD / SELECTOR */
    function triggerFolderUpload() {
      const input = document.getElementById('folderUploadInput');
      input.value = '';
      input.click();
    }

    /* HANDLE NATIVE FOLDER PICKER CHANGE */
    document.getElementById('folderUploadInput').addEventListener('change', function(e) {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Extract root folder name from the first relative path
      const firstPath = files[0].webkitRelativePath || '';
      const parts = firstPath.split('/');
      const rootFolderName = parts.length > 1 ? parts[0] : (files[0].name || '');

      if (rootFolderName) {
        document.getElementById('targetPath').value = rootFolderName;
        showToast('Folder terpilih: ' + rootFolderName + ' (' + files.length + ' file)', 'info');
        startScan();
      }
    });

    /* DRAG & DROP FOLDER SUPPORT */
    const dropzone = document.getElementById('dropzoneBanner');
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const item = items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;
        if (item && item.isDirectory) {
          document.getElementById('targetPath').value = item.name;
          showToast('Folder di-drop: ' + item.name, 'info');
          startScan();
        } else if (e.dataTransfer.files.length > 0) {
          const f = e.dataTransfer.files[0];
          document.getElementById('targetPath').value = f.name;
          startScan();
        }
      }
    });

    /* DIRECTORY BROWSE MODAL */
    function openBrowseModal() {
      const current = document.getElementById('targetPath').value.trim() || '.';
      document.getElementById('browseModal').classList.add('active');
      loadBrowseDirectory(current);
    }

    function closeBrowseModal() {
      document.getElementById('browseModal').classList.remove('active');
    }

    async function loadBrowseDirectory(target) {
      const container = document.getElementById('browseFolderList');
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><span class="spinner"></span> Memuat folder...</div>';
      try {
        const res = await fetch('/api/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: target })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          container.innerHTML = '<div style="color:#f87171;padding:1rem;">Error: ' + escapeHtml(data.error || 'Folder tidak dapat diakses') + '</div>';
          return;
        }

        currentBrowsePath = data.currentPath;
        currentBrowseParent = data.parentPath;
        document.getElementById('browseCurrentPathInput').value = data.currentPath;

        const shortcutsEl = document.getElementById('quickBrowseShortcuts');
        shortcutsEl.innerHTML = '';

        if (data.drives && data.drives.length) {
          data.drives.forEach(drv => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-link';
            btn.textContent = '💽 ' + drv;
            btn.addEventListener('click', () => loadBrowseDirectory(drv));
            shortcutsEl.appendChild(btn);
          });
        }

        if (data.quickShortcuts && data.quickShortcuts.length) {
          data.quickShortcuts.forEach(sc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-link';
            btn.textContent = '📁 ' + sc.name;
            btn.addEventListener('click', () => loadBrowseDirectory(sc.path));
            shortcutsEl.appendChild(btn);
          });
        }

        const subdirs = data.subdirectories || [];
        document.getElementById('browseFolderCount').textContent = subdirs.length + ' subfolder';

        container.innerHTML = '';
        if (subdirs.length === 0) {
          container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Tidak ada subfolder di dalam folder ini.</div>';
        } else {
          subdirs.forEach(d => {
            const item = document.createElement('div');
            item.className = 'folder-grid-item';
            item.innerHTML = '<span style="font-size:1.2rem;">📁</span><span class="folder-name">' + escapeHtml(d.name) + '</span><span style="color:var(--text-muted);font-size:0.75rem;">Buka ➔</span>';
            item.addEventListener('click', () => loadBrowseDirectory(d.path));
            container.appendChild(item);
          });
        }

        document.getElementById('btnBrowseUp').disabled = !data.parentPath;
      } catch (err) {
        container.innerHTML = '<div style="color:#f87171;padding:1rem;">Gagal memuat: ' + escapeHtml(err.message) + '</div>';
      }
    }

    function browseUpDirectory() {
      if (currentBrowseParent) {
        loadBrowseDirectory(currentBrowseParent);
      }
    }

    function selectCurrentBrowseFolder() {
      if (currentBrowsePath) {
        document.getElementById('targetPath').value = currentBrowsePath;
        closeBrowseModal();
        startScan();
      }
    }

    /* CREATE SAMPLE FOLDER */
    async function createSampleFolder() {
      try {
        const pathInput = document.getElementById('targetPath').value || './Bahan Latihan P12';
        const res = await fetch('/api/seed-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: pathInput })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Folder demo & file latihan berhasil dibuat: ' + data.createdFiles + ' file', 'success');
          startScan();
        } else {
          showToast(data.error || 'Gagal membuat folder demo', 'error');
        }
      } catch (err) {
        showToast('Error koneksi: ' + err.message, 'error');
      }
    }

    /* START SCAN */
    async function startScan() {
      const pathInput = document.getElementById('targetPath').value.trim();
      if (!pathInput) {
        showToast('Mohon masukkan atau pilih folder target!', 'error');
        return;
      }

      const btn = document.getElementById('btnScan');
      const icon = document.getElementById('btnScanIcon');
      const text = document.getElementById('btnScanText');
      const statusEl = document.getElementById('scanStatusMsg');

      btn.disabled = true;
      icon.innerHTML = '<span class="spinner"></span>';
      text.textContent = 'Memindai...';

      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(99, 102, 241, 0.12)';
        statusEl.style.color = '#818cf8';
        statusEl.style.border = '1px solid rgba(99, 102, 241, 0.25)';
        statusEl.innerHTML = '⏳ Sedang memindai: <strong>' + escapeHtml(pathInput) + '</strong> (menghitung SHA-256 seluruh file)...';
      }

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: pathInput })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          const errMsg = data.error || 'Gagal memindai folder';
          showToast(errMsg, 'error');
          if (statusEl) {
            statusEl.style.background = 'rgba(244, 63, 94, 0.12)';
            statusEl.style.color = '#fda4af';
            statusEl.style.border = '1px solid rgba(244, 63, 94, 0.3)';
            statusEl.innerHTML = '❌ ' + escapeHtml(errMsg);
          }
          return;
        }

        currentAuditData = data;
        renderDashboard(data);
        showToast('Pemindaian berhasil diselesaikan!', 'success');

        if (statusEl) {
          statusEl.style.background = 'rgba(16, 185, 129, 0.12)';
          statusEl.style.color = '#34d399';
          statusEl.style.border = '1px solid rgba(16, 185, 129, 0.25)';
          statusEl.innerHTML = '✅ Sukses memindai: <strong>' + escapeHtml(data.targetDir) + '</strong> (' + data.metrics.totalFiles + ' berkas diproses)';
        }
      } catch (err) {
        const errText = 'Gagal memproses pemindaian: ' + err.message;
        showToast(errText, 'error');
        if (statusEl) {
          statusEl.style.background = 'rgba(244, 63, 94, 0.12)';
          statusEl.style.color = '#fda4af';
          statusEl.style.border = '1px solid rgba(244, 63, 94, 0.3)';
          statusEl.innerHTML = '❌ ' + escapeHtml(errText);
        }
      } finally {
        btn.disabled = false;
        icon.innerHTML = '🔍';
        text.textContent = 'Pindai Folder';
      }
    }

    /* RENDER DASHBOARD */
    function renderDashboard(data) {
      const m = data.metrics;

      document.getElementById('valTotalFiles').textContent = m.totalFiles.toLocaleString();
      document.getElementById('subTotalFiles').textContent = 'Folder: ' + (data.targetDir || '');

      document.getElementById('valTotalCapacity').textContent = m.totalCapacityFormatted;
      document.getElementById('subTotalCapacity').textContent = (m.totalCapacityBytes).toLocaleString() + ' bytes';

      document.getElementById('valGiantFiles').textContent = m.giantFilesCount;
      document.getElementById('subGiantFiles').textContent = m.giantFilesCount > 0 
        ? m.giantFilesFormatted + ' (&ge;5GB)'
        : 'Tidak ada file &ge;5GB';

      document.getElementById('valSavings').textContent = m.totalPotentialSavingsFormatted;
      document.getElementById('subSavings').textContent = (m.duplicateCopiesCount + m.tmpFilesCount) + ' file dapat dibersihkan';

      const actionBar = document.getElementById('actionBar');
      if (m.totalPotentialSavings > 0) {
        actionBar.style.display = 'flex';
        document.getElementById('actionSubtitle').textContent = 
          'Tersedia ' + m.duplicateCopiesCount + ' salinan duplikat (' + m.potentialDuplicateSavingsFormatted + 
          ') dan ' + m.tmpFilesCount + ' berkas .tmp (' + m.tmpFilesFormatted + ') siap dibersihkan.';
      } else {
        actionBar.style.display = 'none';
      }

      renderGiantTable(data);
      renderDuplicateAccordion(data);
    }

    /* RENDER GIANT FILES TABLE (STG-03) */
    function renderGiantTable(data) {
      const tbody = document.getElementById('giantTableBody');
      const list = data.top15Largest || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada file yang ditemukan pada folder ini.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(f => {
        const flagBadge = f.isGiant 
          ? '<span class="badge-giant">⚠️ FILE RAKSASA (&gt;5GB)</span>'
          : '<span class="badge-normal">STANDAR (&lt;5GB)</span>';

        return '<tr>' +
          '<td><strong style="color:var(--text-muted);">' + f.rank + '</strong></td>' +
          '<td><strong>' + escapeHtml(f.name) + '</strong></td>' +
          '<td><div class="file-path" title="' + escapeHtml(f.absolutePath) + '">' + escapeHtml(f.relativePath || f.absolutePath) + '</div></td>' +
          '<td><span style="font-family:var(--font-mono);font-weight:600;">' + f.sizeMB + '</span> <span style="font-size:0.75rem;color:var(--text-muted);">(' + f.sizeKB + ')</span></td>' +
          '<td>' + flagBadge + '</td>' +
        '</tr>';
      }).join('');
    }

    /* RENDER DUPLICATE ACCORDION (STG-02) */
    function renderDuplicateAccordion(data) {
      const container = document.getElementById('duplicateAccordion');
      const groups = data.top20Duplicates || [];

      if (groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎉</div><div>Bagus sekali! Tidak ditemukan file duplikat dalam folder ini.</div></div>';
        return;
      }

      container.innerHTML = groups.map((g, idx) => {
        const originalHtml = '<div class="file-row original">' +
          '<div>' +
            '<span class="status-tag keep">ASLI (DIPERTAHANKAN)</span> ' +
            '<strong>' + escapeHtml(g.original.name) + '</strong> ' +
            '<span class="file-path" style="display:inline-block;margin-left:0.5rem;">' + escapeHtml(g.original.relativePath) + '</span>' +
          '</div>' +
          '<div style="font-family:var(--font-mono);color:#34d399;">' + g.original.sizeFormatted + '</div>' +
        '</div>';

        const copiesHtml = g.copies.map(c => 
          '<div class="file-row duplicate">' +
            '<div>' +
              '<span class="status-tag delete">SALINAN (DIHAPUS)</span> ' +
              '<strong>' + escapeHtml(c.name) + '</strong> ' +
              '<span class="file-path" style="display:inline-block;margin-left:0.5rem;">' + escapeHtml(c.relativePath) + '</span>' +
            '</div>' +
            '<div style="font-family:var(--font-mono);color:#f87171;">' + c.sizeFormatted + '</div>' +
          '</div>'
        ).join('');

        return '<div class="accordion-item" id="acc-' + idx + '">' +
          '<div class="accordion-header" onclick="toggleAccordion(' + idx + ')">' +
            '<div class="accordion-title">' +
              '<span style="font-weight:700;font-size:0.9rem;">Grup #' + (idx + 1) + '</span>' +
              '<span class="accordion-hash" title="' + g.hash + '">SHA-256: ' + g.hash.substring(0, 16) + '...</span>' +
              '<span style="font-size:0.8rem;color:var(--text-muted);">' + g.fileCount + ' file identik</span>' +
            '</div>' +
            '<div class="accordion-meta">' +
              '<span style="color:#f87171;font-weight:600;">Boros: ' + g.wastedFormatted + '</span>' +
              '<span class="accordion-chevron">▼</span>' +
            '</div>' +
          '</div>' +
          '<div class="accordion-body">' + originalHtml + copiesHtml + '</div>' +
        '</div>';
      }).join('');
    }

    function toggleAccordion(idx) {
      const el = document.getElementById('acc-' + idx);
      if (el) el.classList.toggle('open');
    }

    /* CLEANUP MODAL (STG-05) */
    function openCleanupModal() {
      if (!currentAuditData) return;
      const m = currentAuditData.metrics;

      document.getElementById('modalDupCopiesCount').textContent = m.duplicateCopiesCount + ' file';
      document.getElementById('modalTmpCount').textContent = m.tmpFilesCount + ' file';
      document.getElementById('modalFreedBytes').textContent = m.totalPotentialSavingsFormatted;
      document.getElementById('modalKeptCount').textContent = currentAuditData.top20Duplicates.length + ' file';

      const previewContainer = document.getElementById('modalFilesPreview');
      const previewItems = [];

      for (const g of currentAuditData.top20Duplicates) {
        for (const c of g.copies) {
          previewItems.push({
            name: c.name,
            path: c.relativePath || c.absolutePath,
            size: c.sizeFormatted,
            tag: 'Duplikat'
          });
        }
      }

      for (const t of currentAuditData.tmpFiles) {
        previewItems.push({
          name: t.name,
          path: t.relativePath || t.absolutePath,
          size: t.sizeFormatted,
          tag: 'Berkas .tmp'
        });
      }

      if (previewItems.length === 0) {
        previewContainer.innerHTML = '<div style="padding:0.5rem;color:var(--text-muted);">Tidak ada file yang perlu dihapus.</div>';
      } else {
        previewContainer.innerHTML = previewItems.map(item => 
          '<div class="preview-file-item">' +
            '<span><span style="color:#f87171;">[' + item.tag + ']</span> ' + escapeHtml(item.name) + ' <span style="color:var(--text-muted);font-size:0.72rem;">(' + escapeHtml(item.path) + ')</span></span>' +
            '<span style="color:#cbd5e1;font-weight:600;">' + item.size + '</span>' +
          '</div>'
        ).join('');
      }

      document.getElementById('cleanupModal').classList.add('active');
    }

    function closeCleanupModal() {
      document.getElementById('cleanupModal').classList.remove('active');
    }

    async function executeCleanup() {
      if (!currentAuditData) return;

      const btn = document.getElementById('btnConfirmDelete');
      const text = document.getElementById('btnDeleteText');
      btn.disabled = true;
      text.innerHTML = '<span class="spinner"></span> Menghapus...';

      try {
        const res = await fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: currentAuditData.targetDir })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          showToast(data.error || 'Gagal melakukan pembersihan', 'error');
          return;
        }

        closeCleanupModal();
        showToast('Pembersihan in-place sukses! Dihapus ' + data.deletedCount + ' file (' + data.freedFormatted + ' ruang dibebaskan)', 'success');

        setTimeout(() => {
          startScan();
        }, 800);
      } catch (err) {
        showToast('Gagal mengeksekusi pembersihan: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        text.textContent = 'Konfirmasi Hapus Sekarang';
      }
    }

    // Auto scan on load
    window.addEventListener('DOMContentLoaded', () => {
      startScan();
    });
  </script>
</body>
</html>`;
}

/**
 * Native Node.js HTTP Server & Request Handler
 */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Dashboard Homepage
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtmlContent());
    return;
  }

  const readJsonBody = () => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf-8');
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const trimmed = body.trim();
          resolve(trimmed ? JSON.parse(trimmed) : {});
        } catch (err) {
          reject(new Error('Format JSON tidak valid: ' + err.message));
        }
      });
      req.on('error', err => reject(err));
    });
  };

  // 2. Scan Directory Endpoint (STG-01, STG-02, STG-03)
  if (req.method === 'POST' && pathname === '/api/scan') {
    try {
      const data = await readJsonBody();
      const targetPath = data.folderPath || DEFAULT_FOLDER;
      const thresholdBytes = data.thresholdBytes ? Number(data.thresholdBytes) : GIANT_THRESHOLD_BYTES;
      const result = await auditStorage(targetPath, thresholdBytes);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. Direct Cleanup Endpoint (STG-05)
  if (req.method === 'POST' && pathname === '/api/cleanup') {
    try {
      const data = await readJsonBody();
      const targetPath = data.folderPath || DEFAULT_FOLDER;
      const result = await performCleanup(targetPath);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. Seed Demo Sample Endpoint
  if (req.method === 'POST' && pathname === '/api/seed-sample') {
    try {
      const data = await readJsonBody();
      const targetPath = data.folderPath || DEFAULT_FOLDER;
      const result = seedSampleFolder(targetPath);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. Browse Directory Hierarchy Endpoint
  if (req.method === 'POST' && pathname === '/api/browse') {
    try {
      const data = await readJsonBody();
      const targetPath = data.folderPath || process.cwd();
      const result = browseDirectories(targetPath);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint tidak ditemukan' }));
});

/**
 * Open browser automatically across platforms (STG-06)
 */
function openBrowser(url) {
  const startCmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
    ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(startCmd, (err) => {
    if (err) {
      console.log(`[INFO] Silakan buka dashboard manual di browser: ${url}`);
    }
  });
}

/**
 * Start Server with auto-fallback if port is occupied
 */
function startServer(initialPort = PORT) {
  let currentPort = initialPort;

  const tryListen = (port) => {
    server.removeAllListeners('error');
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[INFO] Port ${port} sudah digunakan. Mencoba port ${port + 1}...`);
        tryListen(port + 1);
      } else {
        console.error(`[ERROR] Server error:`, err);
      }
    });

    server.listen(port, () => {
      const serverUrl = `http://localhost:${port}`;
      console.log(`
==============================================================================
🚀 STORAGE AUDIT & IN-PLACE CLEANER UTILITY
==============================================================================
✓ Server aktif di        : ${serverUrl}
✓ Runtime               : Node.js (Modul Native: http, fs, path, crypto, os)
✓ Zero Dependencies     : Berjalan tanpa perlu "npm install"
✓ Target Default        : ${DEFAULT_FOLDER}
✓ Ambang File Raksasa   : 5 GB (STG-03)
✓ Fitur Upload Folder   : Drag & drop & pemilih folder HTML5 tanpa ketik manual
✓ Dashboard Browser     : Membuka browser secara otomatis...
==============================================================================
Tekan Ctrl + C di terminal untuk menghentikan server.
      `);

      if (!fs.existsSync(DEFAULT_FOLDER)) {
        try {
          seedSampleFolder(DEFAULT_FOLDER);
          console.log(`✓ Folder sampel "${DEFAULT_FOLDER}" otomatis disiapkan untuk pengujian.`);
        } catch (err) {
          console.warn(`[WARN] Gagal membuat folder sampel default: ${err.message}`);
        }
      }

      openBrowser(serverUrl);
    });
  };

  tryListen(currentPort);
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  auditStorage,
  performCleanup,
  seedSampleFolder,
  browseDirectories,
  resolveSmartPath,
  server,
  PORT,
  DEFAULT_FOLDER,
  GIANT_THRESHOLD_BYTES
};
