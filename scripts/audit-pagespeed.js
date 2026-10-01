/**
 * CymaSpace Website - Local PageSpeed / Lighthouse Audit Runner
 * 
 * Runs Google Lighthouse audits locally against the website without needing
 * public hosting or internet uploads.
 * 
 * Features:
 * - Tests Performance, Accessibility, Best Practices, and SEO.
 * - Extracts Core Web Vitals (FCP, LCP, TBT, CLS).
 * - Detects active dev server (e.g. port 5500) or spins up an ephemeral local static server.
 * - Supports Desktop and Mobile emulation presets.
 * - Generates standalone interactive HTML reports in reports/
 * 
 * Usage:
 *   node scripts/audit-pagespeed.js               (defaults to Desktop audit)
 *   node scripts/audit-pagespeed.js --mobile      (runs Mobile audit)
 *   node scripts/audit-pagespeed.js --both        (runs Mobile + Desktop)
 *   node scripts/audit-pagespeed.js --page=news.html
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// Check if a URL is currently responding
function isServerAlive(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'HEAD',
          timeout: 1500
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 400);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

// Built-in zero-dependency static HTTP server for local testing
function startStaticServer(port = 8089) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(ROOT_DIR, reqPath);

      if (!filePath.startsWith(ROOT_DIR)) {
        res.statusCode = 403;
        return res.end('Forbidden');
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.statusCode = 404;
          return res.end('Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'no-cache'
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
      });
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        startStaticServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

function getScoreBadge(score) {
  if (score >= 90) return `🟢 ${score}`;
  if (score >= 50) return `🟡 ${score}`;
  return `🔴 ${score}`;
}

async function runAuditForMode(targetUrl, mode = 'desktop', pageName = 'index.html') {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const cleanPageSlug = pageName.replace(/[\\/]/g, '_').replace(/\.html$/, '');
  const reportPrefix = `lighthouse-${cleanPageSlug}-${mode}`;
  const jsonReportPath = path.join(REPORTS_DIR, `${reportPrefix}.json`);
  const htmlReportPath = path.join(REPORTS_DIR, `${reportPrefix}.html`);

  const presetFlag = mode === 'desktop' ? '--preset=desktop' : '';
  const chromeFlags = '--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage';

  console.log(`\n🚀 Running Lighthouse (${mode.toUpperCase()}) on: ${targetUrl}`);
  console.log(`   Please wait ~15-20 seconds for headless browser metrics...`);

  const cmd = `npx --yes lighthouse "${targetUrl}" ${presetFlag} --chrome-flags="${chromeFlags}" --output=json,html --output-path="${path.join(REPORTS_DIR, reportPrefix)}" --quiet`;

  try {
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    console.error(`❌ Lighthouse failed:`, err.stderr ? err.stderr.toString() : err.message);
    return null;
  }

  // Lighthouse creates report files with extensions .report.json or .report.html
  let actualJsonPath = path.join(REPORTS_DIR, `${reportPrefix}.report.json`);
  if (!fs.existsSync(actualJsonPath)) actualJsonPath = jsonReportPath;

  let actualHtmlPath = path.join(REPORTS_DIR, `${reportPrefix}.report.html`);
  if (!fs.existsSync(actualHtmlPath)) actualHtmlPath = htmlReportPath;

  if (!fs.existsSync(actualJsonPath)) {
    console.error(`❌ Could not locate Lighthouse report output at ${actualJsonPath}`);
    return null;
  }

  const report = JSON.parse(fs.readFileSync(actualJsonPath, 'utf8'));

  const perf = Math.round((report.categories.performance?.score || 0) * 100);
  const a11y = Math.round((report.categories.accessibility?.score || 0) * 100);
  const bp = Math.round((report.categories['best-practices']?.score || 0) * 100);
  const seo = Math.round((report.categories.seo?.score || 0) * 100);

  const audits = report.audits || {};
  const fcp = audits['first-contentful-paint']?.displayValue || 'N/A';
  const lcp = audits['largest-contentful-paint']?.displayValue || 'N/A';
  const tbt = audits['total-blocking-time']?.displayValue || 'N/A';
  const cls = audits['cumulative-layout-shift']?.displayValue || 'N/A';

  console.log(`\n┌──────────────────────────────────────────────┐`);
  console.log(`│   Lighthouse Audit Results (${mode.toUpperCase().padEnd(7)})        │`);
  console.log(`├──────────────────────────────────────────────┤`);
  console.log(`│ Performance:    ${getScoreBadge(perf).padEnd(28)} │`);
  console.log(`│ Accessibility:  ${getScoreBadge(a11y).padEnd(28)} │`);
  console.log(`│ Best Practices: ${getScoreBadge(bp).padEnd(28)} │`);
  console.log(`│ SEO:            ${getScoreBadge(seo).padEnd(28)} │`);
  console.log(`├──────────────────────────────────────────────┤`);
  console.log(`│ Core Web Vitals:                             │`);
  console.log(`│ • FCP (First Contentful Paint): ${fcp.padEnd(12)} │`);
  console.log(`│ • LCP (Largest Contentful Paint): ${lcp.padEnd(10)} │`);
  console.log(`│ • TBT (Total Blocking Time):     ${tbt.padEnd(12)} │`);
  console.log(`│ • CLS (Cumulative Layout Shift): ${cls.padEnd(12)} │`);
  console.log(`└──────────────────────────────────────────────┘`);
  console.log(`📄 Full Interactive HTML Report: ${path.relative(ROOT_DIR, actualHtmlPath)}\n`);

  return { perf, a11y, bp, seo };
}

async function main() {
  const args = process.argv.slice(2);
  const isMobile = args.includes('--mobile');
  const isBoth = args.includes('--both');
  const pageArg = args.find(a => a.startsWith('--page='));
  const targetPage = pageArg ? pageArg.split('=')[1] : 'index.html';

  console.log(`\n==================================================`);
  console.log(`⚡ CymaSpace Local PageSpeed / Lighthouse Audit`);
  console.log(`==================================================`);

  // Check if live server is running on port 5500
  let baseUrl;
  let ephemeralServer = null;

  const liveServerUrl = `http://127.0.0.1:5500/${targetPage}`;
  const is5500Alive = await isServerAlive(liveServerUrl);

  if (is5500Alive) {
    console.log(`📡 Detected active local server at http://127.0.0.1:5500`);
    baseUrl = 'http://127.0.0.1:5500';
  } else {
    console.log(`🌐 No active server detected on port 5500; spinning up local test server...`);
    ephemeralServer = await startStaticServer(8089);
    const addr = ephemeralServer.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
    console.log(`📡 Serving from ephemeral server at ${baseUrl}`);
  }

  const targetUrl = `${baseUrl}/${targetPage.replace(/^\//, '')}`;

  try {
    if (isBoth) {
      await runAuditForMode(targetUrl, 'desktop', targetPage);
      await runAuditForMode(targetUrl, 'mobile', targetPage);
    } else if (isMobile) {
      await runAuditForMode(targetUrl, 'mobile', targetPage);
    } else {
      await runAuditForMode(targetUrl, 'desktop', targetPage);
    }
  } finally {
    if (ephemeralServer) {
      ephemeralServer.close();
      console.log(`🛑 Local test server stopped.`);
    }
  }
}

main().catch(err => {
  console.error(`Fatal error during audit:`, err);
  process.exit(1);
});
