# CymaSpace Website (Sound Made Visible)

Modern, high-performance, accessible static website for **[CymaSpace](https://www.cymaspace.org/)**—a 501(c)(3) Deaf-owned nonprofit technology hub in Portland, Oregon. 

CymaSpace makes arts, media, and culture accessible and inclusive to the Deaf and Hard of Hearing (DHH) community through technology, education, and outreach. This codebase replaces the legacy WordPress system with clean, modular HTML5, modern vanilla CSS, and lightweight vanilla JavaScript.

---

## 🌟 Key Highlights & Features

1. **Complete Page Coverage**:
   - **Home (`index.html`)**: Features the live interactive Cymatic Visualizer, 4 organizational pillars, featured initiatives, community events, news feeds, and sponsor recognition.
   - **Projects (`projects.html`)**: Filterable catalog of installations, hardware, media, and youth programs.
   - **SignKids (`projects/signkids.html`)**: Deep dive into our youth ASL arts and play program, orientation details, and family cohorts.
   - **Our Technology (`projects/technology.html`)**: Highlights the Audiolux One system, modular cymatic triangles, and tactile vibrohaptic furniture prototypes.
   - **See Sound (`projects/see-sound.html`)**: Features the #seeingsounds LED upright piano created for the Oregon Museum of Science & Industry (OMSI) and the Piccolo Violino giant violin.
   - **Media, Film & Puppetry (`projects/media.html`)**: Productions from the CymaSpace Media Lab including *DEAFNESS + MUSIC*, *Mouth Language Device* ASL comedy satire, and community videos.
   - **Woodstock Cafe Events (`community-events.html`)**: Dedicated schedule for Portland's "Sign Language Cafe" (4103 SE Woodstock Blvd), hosting Sign Squad, Sidelined Signers, and community markets.
   - **Events Archive (`events-archive.html`)**: Retrospective history of past festivals, museum residencies, and jam sessions.
   - **Board of Directors (`board-of-directors.html`)**: Profiles of the full governing Board of Directors (Andre Gray, Susan Anderson, Rae Davis, Lennox Zher, Mariya Klintsevich, Scott Kalama).
   - **Our Team (`our-team.html`)**: Forwards seamlessly to `board-of-directors.html`.
   - **Our Mission (`mission.html`)**: Detailed overview of cymatics science, equity, diversity, and inclusion principles.
   - **Code of Conduct (`code-of-conduct.html`)**: The 11 Community Agreements, conflict resolution process, and visitor etiquette.
   - **News & Articles (`news.html`, `news-article.html`)**: Announcements, job postings, and feature articles including our partnership with the Portland Jazz Composers' Ensemble (PJCE).
   - **Support & Donate (`donate.html`)**: Tax-deductible giving tiers, sustaining monthly donor links ([Givebutter](https://givebutter.com/CymaMonthly)), and 501(c)(3) tax disclosures.
   - **Volunteer (`volunteer.html`)**: Community volunteer roles and direct form signup.
   - **Contact (`contact.html`)**: Toll-free voice/text, physical locations, and an accessible message form.

2. **Interactive In-Browser Cymatic Visualizer**:
   - Built directly with HTML5 Canvas and the Web Audio API (`js/visualizer.js`).
   - Simulates real-time Chladni nodal wave patterns and frequencies.
   - Includes tone generator, frequency slider (60Hz–880Hz), live microphone mode, and view toggles (Cymatics, Waveform, Spectrum).

3. **Accessibility First (Deaf & Hard of Hearing Centered)**:
   - WCAG 2.1 AA compliant color contrast on a modern dark cymatics palette.
   - Full keyboard accessibility with skip-to-content links and ARIA attributes.
   - Respects `prefers-reduced-motion` settings.
   - Clearly provides accessible phone, text, and email communication channels.

---

## 📁 Project Architecture & Directory Structure

```
Website/
├── index.html                   # Modern Homepage with Hero & Visualizer
├── projects.html                # Projects Directory (Filterable grid)
├── community-events.html        # Woodstock Cafe / Sign Language Cafe Events
├── events-archive.html          # Historical Events Archive
├── board-of-directors.html      # Dedicated Board of Directors Page
├── our-team.html                # Legacy alias (redirects to Board of Directors)
├── mission.html                 # Mission, Pillars & Cymatics Science
├── code-of-conduct.html         # Code of Conduct & Etiquette
├── news.html                    # News & Updates Feed
├── news-article.html            # Single Article Reader Template
├── donate.html                  # Support Us & Sustaining Donor Tiers
├── volunteer.html               # Volunteer Program & Sign-Up
├── contact.html                 # Contact Info, Phone, Text & Message Form
├── projects/
│   ├── signkids.html            # SignKids Program Deep Dive
│   ├── technology.html          # Hardware: Audiolux One, Triangles & Haptics
│   ├── see-sound.html           # #seeingsounds OMSI Piano & Installations
│   └── media.html               # Films, Comedy Satire & Puppetry
├── css/
│   ├── variables.css            # Design tokens: palette, typography, spacing
│   ├── base.css                 # Reset, typography, layout, accessibility
│   ├── components.css           # Header, mobile drawer, footer, cards, buttons
│   ├── visualizer.css           # Cymatics audio visualizer UI styling
│   └── pages.css                # Page-specific layout tweaks
├── js/
│   ├── main.js                  # Navigation drawer, active state, newsletter
│   ├── visualizer.js            # Interactive HTML5 Canvas cymatic visualizer
│   ├── events.js                # Event and project category filter
│   └── contact.js               # Accessible form validation & feedback
├── assets/
│   └── images/                  # Clean SVGs for logos, badges, and sponsors
└── README.md                    # Project documentation
```

---

## 🚀 Running Locally

Because this site is built with modern static HTML, CSS, and JavaScript, no complex build steps (like Webpack or npm build) are required. You can preview it with any local static server:

### Option 1: Python 3 (Installed on most systems)
```bash
python -m http.server 8000
```
Then open [http://localhost:8000](http://localhost:8000) in your browser.

### Option 2: Node.js `npx serve`
```bash
npx -y serve .
```

### Option 3: VS Code / IDE Live Server
Right-click on `index.html` and select **"Open with Live Server"**.

---

## 🌐 Deploying to Production

This static repository can be deployed instantly to any modern hosting provider:

- **GitHub Pages**:
  1. Go to repository **Settings** &rarr; **Pages**.
  2. Set Source to `Deploy from a branch` and select `main` (or `master`) branch `/ (root)`.
  3. Save. The site will be available live at your GitHub Pages URL or custom domain (`cymaspace.org`).

- **Cloudflare Pages / Netlify / Vercel**:
  - Connect your Git repository.
  - Build command: *(leave blank)*
  - Output directory: `.` (root)

---

## 🤝 Community & Contributing

To update event dates, projects, or news items:
1. Copy the appropriate card component block in `community-events.html`, `projects.html`, or `news.html`.
2. Update the text, date, and link.
3. Commit and push your changes to Git.

For inquiries or partnership proposals, contact **[info@cymaspace.org](mailto:info@cymaspace.org)** or call/text **(888) 312-8584**.

---

*CymaSpace is an Oregon 501(c)(3) nonprofit tax-exempt organization.*
