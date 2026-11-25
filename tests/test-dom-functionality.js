/**
 * Full Sandboxed VM Functional & UI Smoke Test for hyoumoji v2.0
 * Actually executes content.js inside a simulated browser environment!
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// Minimal DOM implementation that supports content.js execution cleanly
class SandboxNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.className = '';
    this.children = [];
    this.attributes = {};
    this.style = {};
    this._textContent = '';
    this.value = '';
    this.title = '';
    this.placeholder = '';
    this.type = '';
    this.parentNode = null;
    this.parentElement = null;
    this.listeners = {};
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.isConnected = true;
    this.classList = {
      add: (...cls) => {
        const set = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach(c => set.add(c));
        this.className = [...set].join(' ');
      },
      remove: (...cls) => {
        const set = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach(c => set.delete(c));
        this.className = [...set].join(' ');
      },
      toggle: (c, force) => {
        const has = this.classList.contains(c);
        const on = force === undefined ? !has : Boolean(force);
        if (on) this.classList.add(c);
        else this.classList.remove(c);
        return on;
      },
      contains: (c) => this.className.split(/\s+/).includes(c)
    };
  }

  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v ?? ''); }

  get innerHTML() { return this._innerHTML || ''; }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (!html || !html.trim()) return;
    // Parse static picker shell elements cleanly for test selectors
    if (html.includes('hyoumoji-tabs')) {
      const mk = (tag, cls, id = '', attrs = {}) => {
        const el = new SandboxNode(tag);
        el.className = cls;
        el.id = id;
        Object.assign(el.attributes, attrs);
        return el;
      };
      this.append(
        mk('span', 'hyoumoji-context-pill', 'hyoumoji-context-badge'),
        mk('button', 'hyoumoji-fit-toggle active', 'hyoumoji-fit-btn', { 'aria-pressed': 'true' }),
        mk('button', 'hyoumoji-close-btn'),
        mk('button', 'hyoumoji-tab-btn', '', { 'data-tab': 'recent', 'aria-selected': 'false' }),
        mk('button', 'hyoumoji-tab-btn', '', { 'data-tab': 'favorites', 'aria-selected': 'false' }),
        mk('button', 'hyoumoji-tab-btn active', '', { 'data-tab': 'emojis', 'aria-selected': 'true' }),
        mk('button', 'hyoumoji-tab-btn', '', { 'data-tab': 'kaomoji', 'aria-selected': 'false' }),
        mk('button', 'hyoumoji-tab-btn', '', { 'data-tab': 'ascii', 'aria-selected': 'false' }),
        mk('input', 'hyoumoji-search-input'),
        mk('button', 'hyoumoji-search-clear-btn'),
        mk('button', 'hyoumoji-search-btn'),
        mk('div', 'hyoumoji-chips-row', 'hyoumoji-chips-container'),
        mk('div', 'hyoumoji-body', 'hyoumoji-tab-content'),
        mk('span', '', 'hyoumoji-footer-hint')
      );
    }
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
  }
  getAttribute(k) { return this.attributes[k] ?? null; }
  hasAttribute(k) { return k in this.attributes; }

  appendChild(c) { c.parentNode = this; c.parentElement = this; this.children.push(c); return c; }
  append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
  prepend(c) { c.parentNode = this; c.parentElement = this; this.children.unshift(c); }
  insertBefore(newChild, ref) {
    newChild.parentNode = this;
    newChild.parentElement = this;
    const idx = this.children.indexOf(ref);
    if (idx > -1) this.children.splice(idx, 0, newChild);
    else this.children.push(newChild);
  }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }
  focus() { this._focused = true; }
  getBoundingClientRect() { return { left: 20, top: 20, bottom: 50, right: 120 }; }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (matchesSimple(cur, sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(ev) {
    ev.target ||= this;
    ev.preventDefault ||= () => {};
    ev.stopPropagation ||= () => {};
    (this.listeners[ev.type] || []).forEach(fn => fn(ev));
  }
  click() { this.dispatchEvent({ type: 'click', target: this }); }

  querySelectorAll(selector) {
    const out = [];
    const parts = selector.split(',').map(s => s.trim());
    const walk = (node) => {
      for (const p of parts) {
        if (matchesDescendant(node, p)) { out.push(node); break; }
      }
      node.children.forEach(walk);
    };
    this.children.forEach(walk);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function matchesSimple(node, sel) {
  if (!sel) return false;
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
  if (sel.startsWith('[')) {
    const m = sel.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (!m) return false;
    return m[2] ? node.getAttribute(m[1]) === m[2] : node.hasAttribute(m[1]);
  }
  return node.tagName.toLowerCase() === sel.toLowerCase();
}

function matchesDescendant(node, sel) {
  const tokens = sel.trim().split(/\s+/);
  if (tokens.length === 1) return matchesSimple(node, tokens[0]);
  if (!matchesSimple(node, tokens[tokens.length - 1])) return false;
  let cur = node.parentNode;
  while (cur) {
    if (matchesSimple(cur, tokens[0])) return true;
    cur = cur.parentNode;
  }
  return false;
}

async function runSandboxTest() {
  console.log('====================================================');
  console.log('🧪 RUNNING FULL SANDBOXED FUNCTIONAL & UI/UX TESTS');
  console.log('====================================================\n');

  const body = new SandboxNode('body');
  const html = new SandboxNode('html');
  html.setAttribute('dark', '');
  html.appendChild(body);

  // Build simulated YouTube comment box in DOM
  const commentBox = new SandboxNode('ytd-commentbox');
  const editable = new SandboxNode('textarea'); // supports direct value checks
  editable.id = 'contenteditable-root';
  editable.setAttribute('contenteditable', 'true');
  const buttons = new SandboxNode('div');
  buttons.id = 'buttons';
  const nativeEmojiBtn = new SandboxNode('button');
  nativeEmojiBtn.id = 'emoji-button';
  buttons.appendChild(nativeEmojiBtn);
  commentBox.append(editable, buttons);
  body.appendChild(commentBox);

  const storedData = { hyoumoji_recents: { stale: true } };
  const removedKeys = [];

  const mockWindow = {
    location: { hostname: 'www.youtube.com', pathname: '/watch' },
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    getComputedStyle: () => ({ backgroundColor: 'rgb(15, 15, 15)' }),
    matchMedia: () => ({ matches: true }),
    addEventListener: () => {}
  };
  mockWindow.top = mockWindow;
  mockWindow.window = mockWindow;

  const sandbox = {
    window: mockWindow,
    self: mockWindow,
    top: mockWindow,
    document: {
      readyState: 'complete',
      documentElement: html,
      body,
      createElement: (tag) => new SandboxNode(tag),
      getElementById: (id) => body.querySelector('#' + id),
      querySelector: (sel) => body.querySelector(sel),
      querySelectorAll: (sel) => body.querySelectorAll(sel),
      addEventListener: (t, fn) => body.addEventListener(t, fn),
      execCommand: () => false
    },
    chrome: {
      runtime: { id: 'test-ext-id', getURL: (p) => `chrome-extension://test/${p}`, lastError: null },
      storage: {
        local: {
          remove: (keys) => removedKeys.push(...keys),
          get: (_keys, cb) => cb({}),
          set: (obj) => Object.assign(storedData, obj)
        }
      }
    },
    fetch: async (url) => {
      const rel = url.replace('chrome-extension://test/', '');
      const fullPath = path.join(ROOT_DIR, rel);
      const text = fs.readFileSync(fullPath, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    },
    MutationObserver: class { observe() {} disconnect() {} },
    Event: class { constructor(type) { this.type = type; } },
    setTimeout,
    clearTimeout,
    console,
    navigator: { clipboard: { writeText: async () => {} } }
  };

  const code = fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8');
  vm.runInNewContext(code, sandbox);
  await new Promise(r => setTimeout(r, 30));

  // 1. Trigger injection & legacy cleanup
  const triggerBtn = buttons.querySelector('.hyoumoji-trigger-btn');
  assert(Boolean(triggerBtn), 'Trigger button automatically injected into YouTube comment box');
  assert(removedKeys.includes('hyoumoji_recents'), 'Purged legacy v1 storage keys on startup');

  // 2. Open picker & verify context + theme
  triggerBtn.click();
  await new Promise(r => setTimeout(r, 40));

  const picker = body.querySelector('#hyoumoji-picker-container');
  assert(picker && picker.style.display === 'flex', 'Picker modal opened cleanly');
  assert(picker.classList.contains('hyoumoji-theme-dark'), 'Detected dark page theme and applied dark token class');
  assert(picker.querySelector('#hyoumoji-context-badge').textContent.includes('YT Comment'), 'Detected YT Long-Form Comment context');

  // 3. Test Search Box + Search Button on Emojis tab
  const searchInput = picker.querySelector('.hyoumoji-search-input');
  const searchBtn = picker.querySelector('.hyoumoji-search-btn');
  const clearBtn = picker.querySelector('.hyoumoji-search-clear-btn');

  searchInput.value = 'fire';
  searchBtn.click();
  await new Promise(r => setTimeout(r, 40));

  const emojiItems = picker.querySelectorAll('.hyoumoji-emoji-item');
  assert(emojiItems.some(b => b.textContent === '🔥'), 'Search button ("fire") returned 🔥 emoji');
  assert(emojiItems.length > 0, `Emoji search rendered ${emojiItems.length} matching results`);

  // 4. Test Clear Search Button
  clearBtn.click();
  await new Promise(r => setTimeout(r, 40));
  assert(searchInput.value === '', 'Clear button emptied search input');

  // 5. Switch to ASCII tab, verify Load More works (>50 items!)
  const asciiTabBtn = picker.querySelectorAll('.hyoumoji-tab-btn').find(b => b.getAttribute('data-tab') === 'ascii');
  asciiTabBtn.click();
  await new Promise(r => setTimeout(r, 50));

  const initialCards = picker.querySelectorAll('.hyoumoji-expr-card').length;
  const loadMoreBtn = picker.querySelector('.hyoumoji-load-more-btn');
  assert(initialCards === 50 && Boolean(loadMoreBtn), `ASCII tab rendered initial page (${initialCards}) with Load More button`);

  loadMoreBtn.click();
  await new Promise(r => setTimeout(r, 50));
  const afterLoadMoreCards = picker.querySelectorAll('.hyoumoji-expr-card').length;
  assert(afterLoadMoreCards === 100, `Load More expanded ASCII tab to ${afterLoadMoreCards} cards (pagination bug fixed!)`);

  // 6. Search ASCII ("pikachu") & insert into box
  searchInput.value = 'pikachu';
  searchBtn.click();
  await new Promise(r => setTimeout(r, 40));
  const pikaCards = picker.querySelectorAll('.hyoumoji-expr-card');
  assert(pikaCards.length >= 1, 'ASCII search button found Pikachu Braille art');

  pikaCards[0].click();
  assert(editable.value.includes('⣿⣿⣿⣿⣿⣿⣿⣿'), 'Clicking ASCII card inserted Braille art into comment input');
  assert(picker.style.display === 'none', 'Picker closed automatically after insert');

  // 7. Reopen on Twitch context, verify keyboard card activation & Escape close
  mockWindow.location.hostname = 'www.twitch.tv';
  mockWindow.location.pathname = '/shroud';
  html.attributes = {}; // Simulate Twitch without YouTube's dark attribute
  triggerBtn.click();
  await new Promise(r => setTimeout(r, 40));
  assert(picker.querySelector('#hyoumoji-context-badge').textContent.includes('Twitch'), 'Switched context dynamically to Twitch (500)');
  assert(picker.classList.contains('hyoumoji-theme-dark'), 'Twitch dark background luminance kept dark theme (not wrongly white)');
  assert(asciiTabBtn.getAttribute('aria-selected') === 'true', 'ARIA selected state accurately tracks active tab');

  const firstAsciiCard = picker.querySelectorAll('.hyoumoji-expr-card')[0];
  assert(firstAsciiCard.getAttribute('role') === 'button' && firstAsciiCard.tabIndex === 0, 'Expression cards are keyboard focusable buttons');

  body.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(picker.style.display === 'none', 'Escape key closes picker cleanly');

  // 8. Verify async rapid tab-switch race protection (ASCII -> Emojis rapidly)
  triggerBtn.click();
  asciiTabBtn.click();
  const emojiTabBtn = picker.querySelectorAll('.hyoumoji-tab-btn').find(b => b.getAttribute('data-tab') === 'emojis');
  emojiTabBtn.click();
  await new Promise(r => setTimeout(r, 80));
  assert(picker.querySelectorAll('.hyoumoji-emoji-item').length > 0 && picker.querySelectorAll('.hyoumoji-ascii-list').length === 0,
    'Rapid tab switch (ASCII -> Emojis) prevented stale async overwrite');

  console.log('\n====================================================');
  console.log(`🏁 SANDBOX FUNCTIONAL TEST: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runSandboxTest().catch(err => {
  console.error(err);
  process.exit(1);
});
