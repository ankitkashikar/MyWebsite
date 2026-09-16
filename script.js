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

  /* ── Delivery service note tooltip ─────────────────────
     Keep the checkout line compact while retaining the ETA/delay detail.
     Hover shows the note on desktop; focus/tap keeps it keyboard/mobile friendly. */
  const serviceNote = document.querySelector('.checkout-service-note');
  if (serviceNote) {
    const tooltipId = 'checkout-delivery-info';
    serviceNote.textContent = '';

    const serviceText = document.createElement('span');
    serviceText.textContent = 'Direct delivery is currently for serviceable addresses in PIN 411057.';

    const infoWrap = document.createElement('span');
    infoWrap.className = 'checkout-info-wrap';

    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.className = 'checkout-info-button';
    infoButton.setAttribute('aria-label', 'Delivery estimate information');
    infoButton.setAttribute('aria-describedby', tooltipId);
    infoButton.textContent = 'i';

    const tooltip = document.createElement('span');
    tooltip.className = 'checkout-info-tooltip';
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = 'Estimated delivery is 35–50 minutes. Traffic, rain, peak demand and delivery-partner availability can increase the ETA.';

    infoWrap.append(infoButton, tooltip);
    serviceNote.append(serviceText, infoWrap);

    const tooltipStyles = document.createElement('style');
    tooltipStyles.textContent = `
      .checkout-service-note{
        display:flex;
        align-items:center;
        gap:6px;
        flex-wrap:wrap;
      }
      .checkout-info-wrap{
        position:relative;
        display:inline-flex;
        align-items:center;
        flex:0 0 auto;
      }
      .checkout-info-button{
        width:18px;
        height:18px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border:1px solid rgba(119,119,119,.75);
        border-radius:50%;
        background:transparent;
        color:#777;
        font:700 11px/1 var(--fb, Arial, sans-serif);
        cursor:help;
        padding:0;
        transition:border-color .15s ease,color .15s ease,background .15s ease;
      }
      .checkout-info-button:hover,
      .checkout-info-button:focus-visible{
        border-color:var(--red,#c0392b);
        color:var(--red,#c0392b);
        background:rgba(192,57,43,.06);
        outline:none;
      }
      .checkout-info-tooltip{
        position:absolute;
        right:0;
        bottom:calc(100% + 9px);
        width:min(290px,calc(100vw - 48px));
        padding:10px 12px;
        border-radius:10px;
        background:#222;
        color:#f4f4f4;
        box-shadow:0 8px 24px rgba(0,0,0,.24);
        font:500 .72rem/1.5 var(--fb, Arial, sans-serif);
        letter-spacing:0;
        text-align:left;
        opacity:0;
        visibility:hidden;
        transform:translateY(4px);
        pointer-events:none;
        z-index:20;
        transition:opacity .15s ease,transform .15s ease,visibility .15s ease;
      }
      .checkout-info-tooltip::after{
        content:'';
        position:absolute;
        right:5px;
        top:100%;
        border:6px solid transparent;
        border-top-color:#222;
      }
      .checkout-info-wrap:hover .checkout-info-tooltip,
      .checkout-info-wrap:focus-within .checkout-info-tooltip{
        opacity:1;
        visibility:visible;
        transform:translateY(0);
      }
    `;
    document.head.appendChild(tooltipStyles);
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