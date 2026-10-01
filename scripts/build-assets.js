/**
 * CymaSpace Website - Asset Minifier & Release Bundler
 * 
 * 1. Bundles and minifies CSS files into css/site.min.css via clean-css
 * 2. Minifies JavaScript files into js/*.min.js via terser
 * 
 * Usage: node scripts/build-assets.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function runCommand(cmd) {
  try {
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}\n`, err.stderr ? err.stderr.toString() : err.message);
    return false;
  }
}

function build() {
  console.log(`\n==================================================`);
  console.log(`📦 CymaSpace Asset Minifier & Release Bundler`);
  console.log(`==================================================\n`);

  let allSuccess = true;

  // 1. Bundle & Minify CSS
  console.log(`🎨 Minifying & Bundling CSS...`);
  const cssSources = [
    'css/variables.css',
    'css/base.css',
    'css/components.css',
    'css/pages.css',
    'css/visualizer.css'
  ];

  let rawCssBytes = 0;
  for (const src of cssSources) {
    const fullPath = path.join(ROOT_DIR, src);
    if (fs.existsSync(fullPath)) {
      rawCssBytes += fs.statSync(fullPath).size;
    }
  }

  const cssOut = 'css/site.min.css';
  const cleanCssCmd = `npx --yes clean-css-cli -o ${cssOut} ${cssSources.join(' ')}`;
  if (runCommand(cleanCssCmd)) {
    const minCssBytes = fs.statSync(path.join(ROOT_DIR, cssOut)).size;
    const savings = (((rawCssBytes - minCssBytes) / rawCssBytes) * 100).toFixed(1);
    console.log(`   ✅ ${cssOut}: ${formatBytes(rawCssBytes)} -> ${formatBytes(minCssBytes)} (-${savings}%)`);
  } else {
    allSuccess = false;
  }

  // 2. Minify JavaScript Files
  console.log(`\n⚡ Minifying JavaScript files...`);
  const jsFiles = [
    { src: 'js/visualizer.js', out: 'js/visualizer.min.js' },
    { src: 'js/site-nav.js', out: 'js/site-nav.min.js' },
    { src: 'js/main.js', out: 'js/main.min.js' },
    { src: 'js/contact.js', out: 'js/contact.min.js' },
    { src: 'js/events.js', out: 'js/events.min.js' }
  ];

  for (const { src, out } of jsFiles) {
    const srcPath = path.join(ROOT_DIR, src);
    const outPath = path.join(ROOT_DIR, out);

    if (!fs.existsSync(srcPath)) continue;

    const rawJsBytes = fs.statSync(srcPath).size;
    const terserCmd = `npx --yes terser ${src} -c -m -o ${out}`;

    if (runCommand(terserCmd)) {
      const minJsBytes = fs.statSync(outPath).size;
      const savings = (((rawJsBytes - minJsBytes) / rawJsBytes) * 100).toFixed(1);
      console.log(`   ✅ ${out}: ${formatBytes(rawJsBytes)} -> ${formatBytes(minJsBytes)} (-${savings}%)`);
    } else {
      allSuccess = false;
    }
  }

  console.log(`\n==================================================`);
  if (allSuccess) {
    console.log(`✨ Asset build completed successfully! Ready for release.`);
  } else {
    console.log(`⚠️ Some assets failed to build. See errors above.`);
  }
  console.log(`==================================================\n`);

  return allSuccess;
}

const success = build();
process.exit(success ? 0 : 1);
