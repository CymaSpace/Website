/**
 * CYMASPACE - Shared Single Source of Truth Navigation Component (<site-nav>)
 * Usage: Insert `<site-nav></site-nav>` (or `<site-nav base="../"></site-nav>` in subdirectories)
 */

class SiteNav extends HTMLElement {
  connectedCallback() {
    this.render();
    this.initEvents();
  }

  detectBase() {
    // 1. Explicit attribute
    const attrBase = this.getAttribute('base');
    if (attrBase !== null) return attrBase;

    // 2. Check if page head has stylesheet link starting with '../../' or '../'
    const sub2DirLink = document.querySelector('link[href^="../../css/"]');
    if (sub2DirLink) return '../../';
    const subDirLink = document.querySelector('link[href^="../css/"]');
    if (subDirLink) return '../';

    // 3. Check pathname
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/projects/umd-news/')) return '../../';
    if (path.includes('/projects/') || path.includes('/news/')) return '../';

    return '';
  }

  render() {
    const base = this.detectBase();
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const currentPath = window.location.pathname.replace(/\\/g, '/');

    // Active section helpers
    const isProjectPage = currentPath.includes('/projects/') || currentFile === 'projects.html';
    const isEventPage = ['community-events.html', 'events-archive.html'].includes(currentFile);
    const isAboutPage = ['mission.html', 'board-of-directors.html', 'code-of-conduct.html', 'our-team.html'].includes(currentFile);
    const isNewsPage = currentPath.includes('/news/') || currentFile === 'news.html';

    this.innerHTML = `
      <!-- Top Announcement Notice Bar -->
      <div class="top-notice-bar" role="region" aria-label="Announcement">
        <div class="container top-notice-content">
          <div>
            <span class="asl-pill">ASL &bull; Deaf-Led</span>
            <span>Visit the <strong>Woodstock Cafe</strong> ("Sign Language Cafe") &bull; 4103 SE Woodstock Blvd</span>
          </div>
          <div class="top-notice-links">
            <a href="${base}community-events.html" class="top-notice-link">Cafe Events &rarr;</a>
            <a href="${base}donate.html" class="top-notice-link" style="color: var(--magenta-bright);">Support Our Mission &hearts;</a>
          </div>
        </div>
      </div>

      <!-- Main Header -->
      <header class="site-header" role="banner">
        <div class="container navbar">
          <a href="${base}index.html" class="brand-logo" aria-label="CymaSpace Homepage">
            <img src="${base}assets/images/cymaspace-logo.svg" alt="CymaSpace Logo" class="brand-icon">
            <div>
              <span class="brand-text">CymaSpace</span>
              <span class="brand-tagline">Sound Made Visible</span>
            </div>
          </a>

          <!-- Desktop Navigation -->
          <nav class="desktop-nav" role="navigation" aria-label="Primary Navigation">
            <ul class="nav-menu">
              <!-- Projects Dropdown -->
              <li class="nav-item-dropdown">
                <a href="${base}projects.html" class="nav-link nav-dropdown-toggle ${isProjectPage ? 'active' : ''}">
                  Projects <span aria-hidden="true">&#9662;</span>
                </a>
                <div class="nav-dropdown-menu">
                  <a href="${base}projects.html" class="nav-dropdown-item ${currentFile === 'projects.html' ? 'active' : ''}">All Projects</a>
                  <a href="${base}projects/universal-music-design.html" class="nav-dropdown-item ${currentFile === 'universal-music-design.html' ? 'active' : ''}">Universal Music Design</a>
                  <a href="${base}projects/umd-news/index.html" class="nav-dropdown-item ${currentPath.includes('/umd-news/') ? 'active' : ''}" style="padding-left: 1.75rem; font-size: 0.85rem; color: var(--text-muted);">&bull; UMD Announcements</a>
                  <a href="${base}projects/signkids.html" class="nav-dropdown-item ${currentFile === 'signkids.html' ? 'active' : ''}">SignKids Program</a>
                  <a href="${base}projects/technology.html" class="nav-dropdown-item ${currentFile === 'technology.html' ? 'active' : ''}">Our Technology</a>
                  <a href="${base}projects/see-sound.html" class="nav-dropdown-item ${currentFile === 'see-sound.html' ? 'active' : ''}">See Sound (OMSI Piano)</a>
                  <a href="${base}projects/media.html" class="nav-dropdown-item ${currentFile === 'media.html' ? 'active' : ''}">Media, Film &amp; Puppetry</a>
                </div>
              </li>

              <!-- Events Dropdown -->
              <li class="nav-item-dropdown">
                <a href="${base}community-events.html" class="nav-link nav-dropdown-toggle ${isEventPage ? 'active' : ''}">
                  Events <span aria-hidden="true">&#9662;</span>
                </a>
                <div class="nav-dropdown-menu">
                  <a href="${base}community-events.html" class="nav-dropdown-item ${currentFile === 'community-events.html' ? 'active' : ''}">Woodstock Cafe Events</a>
                  <a href="${base}events-archive.html" class="nav-dropdown-item ${currentFile === 'events-archive.html' ? 'active' : ''}">Past Events Archive</a>
                </div>
              </li>

              <!-- About Dropdown -->
              <li class="nav-item-dropdown">
                <a href="${base}mission.html" class="nav-link nav-dropdown-toggle ${isAboutPage ? 'active' : ''}">
                  About <span aria-hidden="true">&#9662;</span>
                </a>
                <div class="nav-dropdown-menu">
                  <a href="${base}mission.html" class="nav-dropdown-item ${currentFile === 'mission.html' ? 'active' : ''}">Our Mission &amp; Cymatics</a>
                  <a href="${base}board-of-directors.html" class="nav-dropdown-item ${currentFile === 'board-of-directors.html' ? 'active' : ''}">Board of Directors</a>
                  <a href="${base}code-of-conduct.html" class="nav-dropdown-item ${currentFile === 'code-of-conduct.html' ? 'active' : ''}">Code of Conduct</a>
                </div>
              </li>

              <!-- News -->
              <li>
                <a href="${base}news.html" class="nav-link ${isNewsPage ? 'active' : ''}">News</a>
              </li>

              <!-- Volunteer -->
              <li>
                <a href="${base}volunteer.html" class="nav-link ${currentFile === 'volunteer.html' ? 'active' : ''}">Volunteer</a>
              </li>

              <!-- Contact -->
              <li>
                <a href="${base}contact.html" class="nav-link ${currentFile === 'contact.html' ? 'active' : ''}">Contact</a>
              </li>

              <!-- Donate Button -->
              <li>
                <a href="${base}donate.html" class="btn btn-magenta btn-sm ${currentFile === 'donate.html' ? 'active' : ''}">Donate</a>
              </li>
            </ul>
          </nav>

          <!-- Mobile Toggle Button -->
          <button class="nav-toggle-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobileDrawer">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>

      <!-- Mobile Drawer Backdrop -->
      <div class="mobile-backdrop"></div>

      <!-- Mobile Drawer Overlay -->
      <aside id="mobileDrawer" class="mobile-drawer" aria-label="Mobile Navigation">
        <div class="mobile-drawer-header">
          <a href="${base}index.html" class="mobile-drawer-brand" aria-label="CymaSpace Home">
            <img src="${base}assets/images/cymaspace-logo.svg" alt="CymaSpace Logo" class="brand-icon">
            <span class="brand-text">CymaSpace</span>
          </a>
          <button class="mobile-drawer-close-btn" aria-label="Close navigation menu" type="button">&times;</button>
        </div>
        <div class="mobile-drawer-body">
          <ul class="mobile-nav-list">
            <li><a href="${base}index.html" class="mobile-nav-link ${currentFile === 'index.html' ? 'active' : ''}">Home</a></li>
            <li>
              <a href="${base}projects.html" class="mobile-nav-link ${isProjectPage ? 'active' : ''}">Projects</a>
              <div class="mobile-subnav">
                <a href="${base}projects.html" class="${currentFile === 'projects.html' ? 'active' : ''}">All Projects</a>
                <a href="${base}projects/universal-music-design.html" class="${currentFile === 'universal-music-design.html' ? 'active' : ''}">Universal Music Design</a>
                <a href="${base}projects/umd-news/index.html" class="${currentPath.includes('/umd-news/') ? 'active' : ''}" style="padding-left: 1.5rem; font-size: 0.88rem; color: var(--text-muted);">&bull; UMD Announcements</a>
                <a href="${base}projects/signkids.html" class="${currentFile === 'signkids.html' ? 'active' : ''}">SignKids Program</a>
                <a href="${base}projects/technology.html" class="${currentFile === 'technology.html' ? 'active' : ''}">Our Technology</a>
                <a href="${base}projects/see-sound.html" class="${currentFile === 'see-sound.html' ? 'active' : ''}">See Sound (OMSI Piano)</a>
                <a href="${base}projects/media.html" class="${currentFile === 'media.html' ? 'active' : ''}">Media &amp; Film</a>
              </div>
            </li>
            <li>
              <a href="${base}community-events.html" class="mobile-nav-link ${isEventPage ? 'active' : ''}">Events</a>
              <div class="mobile-subnav">
                <a href="${base}community-events.html" class="${currentFile === 'community-events.html' ? 'active' : ''}">Woodstock Cafe Events</a>
                <a href="${base}events-archive.html" class="${currentFile === 'events-archive.html' ? 'active' : ''}">Past Events Archive</a>
              </div>
            </li>
            <li>
              <a href="${base}mission.html" class="mobile-nav-link ${isAboutPage ? 'active' : ''}">About Us</a>
              <div class="mobile-subnav">
                <a href="${base}mission.html" class="${currentFile === 'mission.html' ? 'active' : ''}">Mission &amp; Cymatics</a>
                <a href="${base}board-of-directors.html" class="${currentFile === 'board-of-directors.html' ? 'active' : ''}">Board of Directors</a>
                <a href="${base}code-of-conduct.html" class="${currentFile === 'code-of-conduct.html' ? 'active' : ''}">Code of Conduct</a>
              </div>
            </li>
            <li><a href="${base}news.html" class="mobile-nav-link ${isNewsPage ? 'active' : ''}">News &amp; Updates</a></li>
            <li><a href="${base}volunteer.html" class="mobile-nav-link ${currentFile === 'volunteer.html' ? 'active' : ''}">Volunteer</a></li>
            <li><a href="${base}contact.html" class="mobile-nav-link ${currentFile === 'contact.html' ? 'active' : ''}">Contact Us</a></li>
          </ul>
          <div class="mobile-drawer-footer">
            <a href="${base}donate.html" class="btn btn-magenta footer-donate-btn">Donate Today</a>
          </div>
        </div>
      </aside>
    `;
  }

  initEvents() {
    const toggleBtn = this.querySelector('.nav-toggle-btn');
    const drawer = this.querySelector('.mobile-drawer');
    const backdrop = this.querySelector('.mobile-backdrop');
    const closeBtn = this.querySelector('.mobile-drawer-close-btn');

    if (!toggleBtn || !drawer || !backdrop) return;

    const toggleMenu = () => {
      const isOpen = drawer.classList.toggle('open');
      backdrop.classList.toggle('open', isOpen);
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('nav-open', isOpen);
    };

    const closeMenu = () => {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    };

    toggleBtn.addEventListener('click', toggleMenu);
    backdrop.addEventListener('click', closeMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    drawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeMenu();
        toggleBtn.focus();
      }
    });
  }
}

if (!customElements.get('site-nav')) {
  customElements.define('site-nav', SiteNav);
}
