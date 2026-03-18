/* ===== SHARED SCRIPT ===== */

document.addEventListener('DOMContentLoaded', () => {

  /* -- Mobile hamburger -- */
  const ham = document.getElementById('ham');
  const mobileNav = document.getElementById('mobileNav');
  if (ham && mobileNav) {
    ham.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      ham.textContent = mobileNav.classList.contains('open') ? '✕' : '☰';
    });
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        ham.textContent = '☰';
      });
    });
  }

  /* -- Active nav link -- */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (path.endsWith(href) && href !== 'index.html') a.classList.add('active');
    if ((path === '/' || path.endsWith('index.html')) && href === 'index.html') a.classList.add('active');
  });

  /* -- Scroll reveal for category items -- */
  const revealItems = document.querySelectorAll('.cat-item, .menu-item, .menu-section');
  if (revealItems.length) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    revealItems.forEach(el => obs.observe(el));
  }

  /* -- Load More social images -- */
  const loadMoreBtn = document.getElementById('loadMore');
  const socialHidden = document.querySelectorAll('.social-hidden');
  if (loadMoreBtn && socialHidden.length) {
    loadMoreBtn.addEventListener('click', () => {
      socialHidden.forEach(img => {
        img.classList.remove('social-hidden');
        img.style.display = '';
      });
      loadMoreBtn.style.display = 'none';
    });
  }

  /* -- Reservation form validation -- */
  const joinBtn = document.querySelector('.btn-join');
  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const emailInput = document.querySelector('.newsletter-row input[type="email"]');
      if (emailInput && emailInput.value.includes('@')) {
        joinBtn.textContent = '✓ Subscribed!';
        joinBtn.style.background = '#2e7d32';
        emailInput.value = '';
      } else if (emailInput) {
        emailInput.style.borderColor = 'red';
        setTimeout(() => emailInput.style.borderColor = '', 1800);
      }
    });
  }

  /* -- Order form submit -- */
  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = orderForm.querySelector('.btn-submit');
      btn.textContent = '✓ Order Placed! We'll see you soon.';
      btn.style.background = '#2e7d32';
      btn.disabled = true;
    });
  }

  /* -- Navbar scroll shadow -- */
  window.addEventListener('scroll', () => {
    const nb = document.querySelector('.navbar');
    if (nb) {
      nb.style.boxShadow = window.scrollY > 10 ? '0 2px 16px rgba(0,0,0,0.1)' : 'none';
    }
  });

});
