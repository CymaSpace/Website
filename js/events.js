/**
 * CYMASPACE - Events & Projects Filtering
 */

document.addEventListener('DOMContentLoaded', () => {
  initFilterBars();
});

function initFilterBars() {
  const filterBars = document.querySelectorAll('.filter-bar');

  filterBars.forEach(bar => {
    const buttons = bar.querySelectorAll('.filter-btn');
    const targetSelector = bar.getAttribute('data-target') || '.filterable-item';
    const items = document.querySelectorAll(targetSelector);

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        items.forEach(item => {
          if (filter === 'all' || item.getAttribute('data-category') === filter || item.classList.contains(filter)) {
            item.style.display = '';
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  });
}
