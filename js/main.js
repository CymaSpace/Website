/**
 * CYMASPACE - Main Navigation & Global Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initNewsletterForm();
  highlightActiveLink();
});

/**
 * Mobile Navigation Drawer & Backdrop Handling
 */
function initNavigation() {
  const toggleBtn = document.querySelector('.nav-toggle-btn');
  const drawer = document.querySelector('.mobile-drawer');
  const backdrop = document.querySelector('.mobile-backdrop');

  if (!toggleBtn || !drawer || !backdrop) return;

  function toggleMenu() {
    const isOpen = drawer.classList.toggle('open');
    backdrop.classList.toggle('open', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function closeMenu() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', toggleMenu);
  backdrop.addEventListener('click', closeMenu);

  // Close drawer on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeMenu();
      toggleBtn.focus();
    }
  });
}

/**
 * Highlight active link based on current path
 */
function highlightActiveLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('.nav-link, .mobile-nav-link, .nav-dropdown-item');

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const targetFile = href.split('/').pop();

    if (targetFile === currentPath || (currentPath === '' && targetFile === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/**
 * Handle Newsletter form submission with accessible feedback
 */
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const statusMsg = document.getElementById('newsletterStatus');

    if (!emailInput || !emailInput.value.trim()) return;

    if (statusMsg) {
      statusMsg.textContent = 'Thank you for subscribing to CymaSpace community updates!';
      statusMsg.style.color = 'var(--cyan-bright)';
      statusMsg.style.display = 'block';
    }

    emailInput.value = '';
  });
}
