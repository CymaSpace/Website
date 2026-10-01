/**
 * CymaSpace Website - Dead Link & Asset Validator
 * 
 * Scans all HTML files across the website for:
 * 1. Broken local href links (<a href="...">)
 * 2. Broken media sources (<img src="...">, <video src="...">, <source src="...">)
 * 3. Broken stylesheets & icons (<link href="...">)
 * 4. Broken scripts (<script src="...">)
 * 5. Broken in-page anchors (<a href="#hash"> or <a href="page.html#hash">)
 * 
 * Usage: node scripts/check-links.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to recursively collect all HTML files
function getHtmlFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const ignoredDirs = new Set(['node_modules', 'reports', 'scratch', 'dist', '.git', '.agents', '.gemini']);
    if (item.startsWith('.') || ignoredDirs.has(item)) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getHtmlFiles(fullPath, fileList);
    } else if (item.endsWith('.html')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// Extract element IDs from HTML file to validate anchor hashes
const idCache = new Map();
function getElementIds(filePath) {
  if (idCache.has(filePath)) return idCache.get(filePath);
  const ids = new Set();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const idRegex = /(?:id|name)=["']([^"']+)["']/gi;
    let match;
    while ((match = idRegex.exec(content)) !== null) {
      ids.add(match[1]);
    }
  } catch (err) {
    // File doesn't exist
  }
  idCache.set(filePath, ids);
  return ids;
}

function checkLinks() {
  const htmlFiles = getHtmlFiles(ROOT_DIR);
  console.log(`\n==================================================`);
  console.log(`🔍 CymaSpace Dead Link & Asset Audit`);
  console.log(`Scanning ${htmlFiles.length} HTML pages across repository...`);
  console.log(`==================================================\n`);

  const results = {
    totalChecked: 0,
    brokenLinks: [],
    brokenAssets: [],
    brokenAnchors: []
  };

  const tagPatterns = [
    { tag: 'a', attr: 'href', type: 'link' },
    { tag: 'link', attr: 'href', type: 'asset' },
    { tag: 'img', attr: 'src', type: 'asset' },
    { tag: 'script', attr: 'src', type: 'asset' },
    { tag: 'source', attr: 'src', type: 'asset' },
    { tag: 'video', attr: 'src', type: 'asset' },
    { tag: 'iframe', attr: 'src', type: 'asset' }
  ];

  for (const filePath of htmlFiles) {
    const relHtmlPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNum = lineIdx + 1;

      for (const { tag, attr, type } of tagPatterns) {
        // Regex to capture attribute values inside specific tag
        const regex = new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["']`, 'gi');
        let match;

        while ((match = regex.exec(line)) !== null) {
          const rawUrl = match[1].trim();
          results.totalChecked++;

          // Skip external, protocol-relative, and non-navigational links
          if (
            rawUrl.startsWith('http://') ||
            rawUrl.startsWith('https://') ||
            rawUrl.startsWith('//') ||
            rawUrl.startsWith('mailto:') ||
            rawUrl.startsWith('tel:') ||
            rawUrl.startsWith('javascript:') ||
            rawUrl.startsWith('data:') ||
            rawUrl.startsWith('blob:') ||
            rawUrl.includes('${') ||
            rawUrl === ''
          ) {
            continue;
          }

          // In-page hash link (#section)
          if (rawUrl.startsWith('#')) {
            const hash = rawUrl.slice(1);
            if (hash && hash !== '!' && hash !== '') {
              const ids = getElementIds(filePath);
              if (!ids.has(hash)) {
                results.brokenAnchors.push({
                  file: relHtmlPath,
                  line: lineNum,
                  url: rawUrl,
                  reason: `Anchor ID '#${hash}' not found in current page`
                });
              }
            }
            continue;
          }

          // Parse local path and optional hash
          const [urlWithoutHash, hash] = rawUrl.split('#');
          const cleanPath = urlWithoutHash.split('?')[0];

          // Determine target file on disk
          let targetPath;
          if (cleanPath.startsWith('/')) {
            // Absolute path from website root
            targetPath = path.join(ROOT_DIR, cleanPath.replace(/^\//, ''));
          } else {
            // Relative path from current HTML file
            targetPath = path.resolve(path.dirname(filePath), cleanPath);
          }

          // If target is a directory, check for index.html
          let exists = fs.existsSync(targetPath);
          if (exists && fs.statSync(targetPath).isDirectory()) {
            targetPath = path.join(targetPath, 'index.html');
            exists = fs.existsSync(targetPath);
          }

          if (!exists) {
            const errorRecord = {
              file: relHtmlPath,
              line: lineNum,
              url: rawUrl,
              resolvedPath: path.relative(ROOT_DIR, targetPath).replace(/\\/g, '/'),
              reason: 'File does not exist on disk (404)'
            };
            if (type === 'asset') {
              results.brokenAssets.push(errorRecord);
            } else {
              results.brokenLinks.push(errorRecord);
            }
          } else if (hash) {
            // Target file exists, now check if target hash ID exists
            const ids = getElementIds(targetPath);
            if (!ids.has(hash)) {
              results.brokenAnchors.push({
                file: relHtmlPath,
                line: lineNum,
                url: rawUrl,
                reason: `Anchor ID '#${hash}' not found in target file ${path.relative(ROOT_DIR, targetPath).replace(/\\/g, '/')}`
              });
            }
          }
        }
      }
    }
  }

  // Also validate shared site-nav.js template links
  const siteNavPath = path.join(ROOT_DIR, 'js', 'site-nav.js');
  if (fs.existsSync(siteNavPath)) {
    const navContent = fs.readFileSync(siteNavPath, 'utf8');
    const linkRegex = /href=["']\${base}([^"']+)["']/g;
    let navMatch;
    while ((navMatch = linkRegex.exec(navContent)) !== null) {
      const linkTarget = navMatch[1].split('#')[0].split('?')[0];
      const targetPath = path.join(ROOT_DIR, linkTarget);
      if (!fs.existsSync(targetPath)) {
        results.brokenLinks.push({
          file: 'js/site-nav.js',
          line: 0,
          url: `\${base}${navMatch[1]}`,
          resolvedPath: linkTarget,
          reason: 'File does not exist in root'
        });
      }
    }
  }

  // Output report
  console.log(`Audit Complete: ${results.totalChecked} local URLs evaluated.\n`);

  const totalErrors = results.brokenLinks.length + results.brokenAssets.length + results.brokenAnchors.length;

  if (totalErrors === 0) {
    console.log(`✅ EXCELLENT: Zero dead links or broken assets found! All local references resolve cleanly.\n`);
    return true;
  }

  if (results.brokenLinks.length > 0) {
    console.log(`❌ BROKEN LINKS (${results.brokenLinks.length}):`);
    for (const item of results.brokenLinks) {
      console.log(`   • [${item.file}:${item.line}] href="${item.url}" -> ${item.reason} (looked for: ${item.resolvedPath})`);
    }
    console.log('');
  }

  if (results.brokenAssets.length > 0) {
    console.log(`❌ BROKEN ASSETS / SCRIPTS / STYLES (${results.brokenAssets.length}):`);
    for (const item of results.brokenAssets) {
      console.log(`   • [${item.file}:${item.line}] src="${item.url}" -> ${item.reason} (looked for: ${item.resolvedPath})`);
    }
    console.log('');
  }

  if (results.brokenAnchors.length > 0) {
    console.log(`⚠️  BROKEN IN-PAGE ANCHORS (${results.brokenAnchors.length}):`);
    for (const item of results.brokenAnchors) {
      console.log(`   • [${item.file}:${item.line}] href="${item.url}" -> ${item.reason}`);
    }
    console.log('');
  }

  return false;
}

const passed = checkLinks();
process.exit(passed ? 0 : 1);
