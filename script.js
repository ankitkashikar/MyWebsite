/* ============================================================
   The Chinese Bliss — script.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Hamburger ───────────────────────────────────────── */
  const ham       = document.getElementById('ham');
  const mobileNav = document.getElementById('mobileNav');

  if (ham && mobileNav) {
    ham.addEventListener('click', () => {
      ham.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });
    // close when a link is tapped
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        ham.classList.remove('open');
        mobileNav.classList.remove('open');
      });
    });
  }

  /* ── Load More (social grid) ─────────────────────────── */
  const loadMoreBtn = document.getElementById('loadMore');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      document.querySelectorAll('.social-hidden').forEach(img => {
        img.classList.remove('social-hidden');
        img.style.display = '';
      });
      loadMoreBtn.style.display = 'none';
    });
  }

  /* ── Intersection Observer — unified scroll reveal ───── */
  const revealItems = document.querySelectorAll(
    '.reveal, .zoom-on-scroll, .zoom-section, .cat-item, .menu-section'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;

      // new class
      if (el.classList.contains('reveal'))         el.classList.add('visible');
      // legacy classes
      if (el.classList.contains('zoom-on-scroll')) el.classList.add('zoomed');
      if (el.classList.contains('zoom-section'))   el.classList.add('zoomed');
      // category items (old .visible system)
      if (el.classList.contains('cat-item'))       el.classList.add('visible');
      // menu sections
      if (el.classList.contains('menu-section'))   el.classList.add('zoomed');

      observer.unobserve(el);
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealItems.forEach(el => observer.observe(el));

  /* ── Navbar scroll shadow ────────────────────────────── */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 10) {
        navbar.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35)';
      } else {
        navbar.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

});
