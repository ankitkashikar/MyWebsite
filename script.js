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

  /* ── Combo picker ──────────────────────────────────────
     The real <select> stays in the DOM and remains the source of truth.
     Selecting a custom option updates it and dispatches `change`, so the
     existing menu/cart logic continues to receive the same event. */
  const comboSelects = document.querySelectorAll('.combo-select');

  if (comboSelects.length) {
    const closeAllComboPickers = (except = null) => {
      document.querySelectorAll('.combo-picker.open').forEach(picker => {
        if (picker === except) return;
        picker.classList.remove('open');
        picker.closest('.combo-row')?.classList.remove('combo-dropdown-open');
        picker.querySelector('.combo-picker-trigger')?.setAttribute('aria-expanded', 'false');
      });
    };

    comboSelects.forEach((select, index) => {
      if (select.dataset.customized === 'true') return;
      select.dataset.customized = 'true';
      select.classList.add('combo-native-select');
      select.tabIndex = -1;

      const picker = document.createElement('div');
      picker.className = 'combo-picker';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'combo-picker-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');

      const label = select.closest('.menu-row-info')?.querySelector('.combo-select-label')?.textContent?.trim();
      if (label) trigger.setAttribute('aria-label', label);

      const valueText = document.createElement('span');
      valueText.className = 'combo-picker-value';

      const chevron = document.createElement('span');
      chevron.className = 'combo-picker-chevron';
      chevron.setAttribute('aria-hidden', 'true');

      trigger.append(valueText, chevron);

      const menu = document.createElement('div');
      menu.className = 'combo-picker-menu';
      menu.id = `combo-picker-${index}`;
      menu.setAttribute('role', 'listbox');
      trigger.setAttribute('aria-controls', menu.id);

      const optionButtons = [];

      Array.from(select.options).forEach((option, optionIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'combo-picker-option';
        btn.textContent = option.textContent;
        btn.dataset.value = option.value;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', option.selected ? 'true' : 'false');
        btn.tabIndex = -1;

        btn.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncPicker();
          closePicker();
          trigger.focus();
        });

        btn.addEventListener('keydown', (event) => {
          const current = optionButtons.indexOf(btn);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            optionButtons[(current + 1) % optionButtons.length]?.focus();
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            optionButtons[(current - 1 + optionButtons.length) % optionButtons.length]?.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            closePicker();
            trigger.focus();
          } else if (event.key === 'Home') {
            event.preventDefault();
            optionButtons[0]?.focus();
          } else if (event.key === 'End') {
            event.preventDefault();
            optionButtons[optionButtons.length - 1]?.focus();
          }
        });

        optionButtons.push(btn);
        menu.appendChild(btn);
      });

      const syncPicker = () => {
        const selected = select.options[select.selectedIndex];
        valueText.textContent = selected?.textContent || 'Choose an option';
        optionButtons.forEach(btn => {
          const isSelected = btn.dataset.value === select.value;
          btn.classList.toggle('selected', isSelected);
          btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
      };

      const openPicker = () => {
        closeAllComboPickers(picker);
        picker.classList.add('open');
        picker.closest('.combo-row')?.classList.add('combo-dropdown-open');
        trigger.setAttribute('aria-expanded', 'true');
        const selectedButton = optionButtons.find(btn => btn.classList.contains('selected'));
        requestAnimationFrame(() => selectedButton?.focus());
      };

      const closePicker = () => {
        picker.classList.remove('open');
        picker.closest('.combo-row')?.classList.remove('combo-dropdown-open');
        trigger.setAttribute('aria-expanded', 'false');
      };

      trigger.addEventListener('click', () => {
        if (picker.classList.contains('open')) closePicker();
        else openPicker();
      });

      trigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        } else if (event.key === 'Escape') {
          closePicker();
        }
      });

      select.addEventListener('change', syncPicker);
      picker.append(trigger, menu);
      select.insertAdjacentElement('afterend', picker);
      syncPicker();
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.combo-picker')) closeAllComboPickers();
    });
  }

});
