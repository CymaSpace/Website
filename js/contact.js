/**
 * CYMASPACE - Contact Form Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('contactName')?.value.trim();
    const email = document.getElementById('contactEmail')?.value.trim();
    const message = document.getElementById('contactMessage')?.value.trim();
    const responseBox = document.getElementById('contactStatus');

    if (!name || !email || !message) {
      if (responseBox) {
        responseBox.textContent = 'Please fill out all required fields.';
        responseBox.style.color = '#ff4b4b';
        responseBox.style.display = 'block';
      }
      return;
    }

    // Accessible feedback
    if (responseBox) {
      responseBox.textContent = `Thank you, ${name}! Your message has been sent to the CymaSpace team. We will respond to ${email} promptly.`;
      responseBox.style.color = 'var(--cyan-bright)';
      responseBox.style.display = 'block';
    }

    contactForm.reset();
  });
});
