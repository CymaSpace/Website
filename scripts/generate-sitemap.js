const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = 'https://www.cymaspace.org';

function getHtmlFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const ignoredDirs = new Set(['node_modules', 'reports', 'scratch', 'dist', '.git', '.agents', '.gemini', 'tests']);
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

function generateSitemap() {
  const htmlFiles = getHtmlFiles(ROOT_DIR);
  const urls = [];

  for (const file of htmlFiles) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    
    // Determine priority and changefreq
    let priority = '0.7';
    let changefreq = 'monthly';

    if (rel === 'index.html') {
      priority = '1.0';
      changefreq = 'weekly';
      urls.push({
        loc: `${BASE_URL}/`,
        lastmod: '2026-09-30',
        changefreq,
        priority
      });
      continue;
    }

    if (['about.html', 'technology.html', 'education.html', 'projects.html', 'community-events.html', 'donate.html', 'news.html'].includes(rel)) {
      priority = '0.9';
      changefreq = 'weekly';
    } else if (rel.startsWith('news/')) {
      priority = '0.75';
      changefreq = 'monthly';
    } else if (rel.startsWith('projects/umd-news/')) {
      priority = '0.7';
      changefreq = 'monthly';
    } else if (rel === 'projects/universal-music-design.html') {
      priority = '0.85';
      changefreq = 'monthly';
    } else if (['contact.html', 'volunteer.html', 'board-of-directors.html', 'mission.html'].includes(rel)) {
      priority = '0.8';
      changefreq = 'monthly';
    }

    urls.push({
      loc: `${BASE_URL}/${rel}`,
      lastmod: '2026-09-30',
      changefreq,
      priority
    });
  }

  // Sort by loc for clean determinism
  urls.sort((a, b) => a.loc.localeCompare(b.loc));

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${u.loc}</loc>\n`;
    xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
    xml += `    <priority>${u.priority}</priority>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';

  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`Generated sitemap.xml with ${urls.length} URLs.`);
}

generateSitemap();
