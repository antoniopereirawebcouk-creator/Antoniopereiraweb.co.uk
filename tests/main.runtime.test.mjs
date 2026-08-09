import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, ...event });
    }
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement extends FakeEventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.hidden = false;
    this.open = false;
    this.focusCount = 0;
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, value),
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {
    this.focusCount += 1;
  }

  closest(selector) {
    return selector === 'a[href]' && this.isAnchor ? this : null;
  }
}

class FakeMediaQuery extends FakeEventTarget {
  constructor(matches) {
    super();
    this.matches = matches;
  }
}

function createRuntime({ mobile = true, reducedMotion = false, revealCount = 2 } = {}) {
  const body = new FakeElement();
  const header = new FakeElement();
  const menuToggle = new FakeElement();
  menuToggle.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  const nav = new FakeElement();
  const faqItems = [new FakeElement(), new FakeElement(), new FakeElement()];
  const revealItems = Array.from({ length: revealCount }, () => new FakeElement());
  const mobileQuery = new FakeMediaQuery(mobile);
  const motionQuery = new FakeMediaQuery(reducedMotion);

  class FakeDocument extends FakeEventTarget {
    constructor() {
      super();
      this.body = body;
    }

    querySelector(selector) {
      return {
        '[data-site-header]': header,
        '[data-menu-toggle]': menuToggle,
        '[data-nav]': nav,
      }[selector] ?? null;
    }

    querySelectorAll(selector) {
      if (selector === 'details.faq-item') return faqItems;
      if (selector === '[data-reveal]') return revealItems;
      return [];
    }
  }

  class FakeWindow extends FakeEventTarget {
    constructor() {
      super();
      this.scrollY = 0;
      this.observers = [];
      const owner = this;
      this.IntersectionObserver = class {
        constructor(callback, options) {
          this.callback = callback;
          this.options = options;
          this.observed = [];
          this.unobserved = [];
          owner.observers.push(this);
        }

        observe(item) {
          this.observed.push(item);
        }

        unobserve(item) {
          this.unobserved.push(item);
        }
      };
    }

    matchMedia(query) {
      return query.includes('max-width') ? mobileQuery : motionQuery;
    }
  }

  const document = new FakeDocument();
  const window = new FakeWindow();
  const source = fs.readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { document, window, Element: FakeElement });

  return {
    body,
    document,
    faqItems,
    header,
    menuToggle,
    mobileQuery,
    motionQuery,
    nav,
    revealItems,
    window,
  };
}

test('mobile menu runtime handles toggle, link selection, Escape focus, and desktop resize', () => {
  const runtime = createRuntime({ mobile: true });

  assert.equal(runtime.menuToggle.hidden, false);
  assert.equal(runtime.nav.hidden, true);
  assert.equal(runtime.body.classList.contains('site-body--js'), true);

  runtime.menuToggle.dispatch('click');
  assert.equal(runtime.menuToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(runtime.nav.hidden, false);
  assert.equal(runtime.body.classList.contains('site-body--nav-open'), true);

  const anchor = new FakeElement();
  anchor.isAnchor = true;
  runtime.nav.dispatch('click', { target: anchor });
  assert.equal(runtime.menuToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(runtime.nav.hidden, true);

  runtime.menuToggle.dispatch('click');
  runtime.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(runtime.menuToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(runtime.menuToggle.focusCount, 1);

  runtime.mobileQuery.matches = false;
  runtime.mobileQuery.dispatch('change');
  assert.equal(runtime.menuToggle.hidden, true);
  assert.equal(runtime.nav.hidden, false);
});

test('FAQ runtime keeps only the newly opened item expanded', () => {
  const runtime = createRuntime();
  runtime.faqItems[0].open = true;
  runtime.faqItems[1].open = true;

  runtime.faqItems[1].dispatch('toggle');

  assert.equal(runtime.faqItems[0].open, false);
  assert.equal(runtime.faqItems[1].open, true);
  assert.equal(runtime.faqItems[2].open, false);
});

test('header and reveal runtime obey scroll, observer, and reduced-motion states', () => {
  const runtime = createRuntime({ reducedMotion: false, revealCount: 3 });

  assert.equal(runtime.header.classList.contains('site-header--compact'), false);
  runtime.window.scrollY = 19;
  runtime.window.dispatch('scroll');
  assert.equal(runtime.header.classList.contains('site-header--compact'), true);

  assert.equal(runtime.window.observers.length, 1);
  const [observer] = runtime.window.observers;
  assert.deepEqual(observer.observed, runtime.revealItems);
  assert.equal(observer.options.threshold, 0.2);
  assert.equal(runtime.revealItems[2].style.values.get('--reveal-delay'), '110ms');

  observer.callback([{ isIntersecting: true, target: runtime.revealItems[0] }], observer);
  assert.equal(runtime.revealItems[0].classList.contains('is-visible'), true);
  assert.deepEqual(observer.unobserved, [runtime.revealItems[0]]);

  const reducedRuntime = createRuntime({ reducedMotion: true });
  assert.equal(reducedRuntime.window.observers.length, 0);
  assert.equal(reducedRuntime.revealItems[0].classList.contains('reveal-ready'), false);
});
