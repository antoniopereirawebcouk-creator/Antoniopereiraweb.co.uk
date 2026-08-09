(function () {
  const doc = globalThis.document;
  const win = globalThis.window;

  if (!doc || !win || !doc.body) {
    return;
  }

  const body = doc.body;
  const header = doc.querySelector('[data-site-header]');
  const menuToggle = doc.querySelector('[data-menu-toggle]');
  const nav = doc.querySelector('[data-nav]');
  const faqItems = Array.from(doc.querySelectorAll('details.faq-item'));
  const revealItems = Array.from(doc.querySelectorAll('[data-reveal]'));
  const mobileQuery =
    typeof win.matchMedia === 'function'
      ? win.matchMedia('(max-width: 759px)')
      : { matches: false };
  const motionQuery =
    typeof win.matchMedia === 'function'
      ? win.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };
  let isMenuOpen = false;

  body.classList.add('site-body--js');

  function setMenuState(open, options = {}) {
    if (!menuToggle || !nav) {
      return;
    }

    isMenuOpen = open;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.hidden = mobileQuery.matches ? !open : false;
    body.classList.toggle('site-body--nav-open', mobileQuery.matches && open);

    if (!open && options.focusToggle) {
      menuToggle.focus();
    }
  }

  function syncMenuLayout() {
    if (!menuToggle || !nav) {
      return;
    }

    const isMobile = !!mobileQuery.matches;

    menuToggle.hidden = !isMobile;

    if (!isMobile) {
      setMenuState(false);
      nav.hidden = false;
      return;
    }

    setMenuState(false);
  }

  function syncHeaderState() {
    if (!header) {
      return;
    }

    const scrollOffset = win.scrollY ?? win.pageYOffset ?? 0;
    header.classList.toggle('site-header--compact', scrollOffset > 18);
  }

  if (menuToggle && nav) {
    syncMenuLayout();

    menuToggle.addEventListener('click', function () {
      setMenuState(!isMenuOpen);
    });

    nav.addEventListener('click', function (event) {
      const target = event.target;

      if (!mobileQuery.matches || !(target instanceof Element)) {
        return;
      }

      if (target.closest('a[href]')) {
        setMenuState(false);
      }
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isMenuOpen) {
        setMenuState(false, { focusToggle: true });
      }
    });

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncMenuLayout);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(syncMenuLayout);
    }
  }

  if (faqItems.length > 1) {
    faqItems.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) {
          return;
        }

        faqItems.forEach(function (otherItem) {
          if (otherItem !== item) {
            otherItem.open = false;
          }
        });
      });
    });
  }

  syncHeaderState();
  win.addEventListener('scroll', syncHeaderState, { passive: true });

  if (
    revealItems.length > 0 &&
    !motionQuery.matches &&
    typeof win.IntersectionObserver === 'function'
  ) {
    const revealObserver = new win.IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    revealItems.forEach(function (item, index) {
      item.classList.add('reveal-ready');
      item.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 55}ms`);
      revealObserver.observe(item);
    });
  }
})();
