/**
 * Full Sandboxed VM Functional & UI/UX Test for hyoumoji
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
        mk('button', 'hyoumoji-tab-btn', '', { 'data-tab': 'ascii', 'aria-selected': 'false' }),
        mk('input', 'hyoumoji-search-input'),
        mk('button', 'hyoumoji-search-clear-btn'),
        mk('button', 'hyoumoji-search-btn'),
        mk('div', 'hyoumoji-subbar', 'hyoumoji-subbar-container'),
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
  if (sel.startsWith('.')) {
    return sel.slice(1).split('.').every(cls => node.classList.contains(cls));
  }
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
  console.log('🧪 RUNNING SANDBOXED FUNCTIONAL & UI/UX TESTS');
  console.log('====================================================\n');

  const body = new SandboxNode('body');
  const html = new SandboxNode('html');
  html.appendChild(body);

  const commentBox = new SandboxNode('ytd-commentbox');
  const editable = new SandboxNode('textarea');
  editable.id = 'contenteditable-root';
  editable.setAttribute('contenteditable', 'true');
  const buttons = new SandboxNode('div');
  buttons.id = 'buttons';
  const nativeEmojiBtn = new SandboxNode('button');
  nativeEmojiBtn.id = 'emoji-button';
  buttons.appendChild(nativeEmojiBtn);
  commentBox.append(editable, buttons);
  body.appendChild(commentBox);

  const mockWindow = {
    location: { hostname: 'www.youtube.com', pathname: '/watch' },
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
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
      storage: { local: { remove: () => {}, get: (_k, cb) => cb({}), set: () => {} } }
    },
    fetch: async (url) => {
      const rel = url.replace('chrome-extension://test/', '');
      const text = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    },
    MutationObserver: class { observe() {} disconnect() {} },
    Event: class { constructor(type) { this.type = type; } },
    setTimeout,
    clearTimeout,
    console,
    navigator: { clipboard: { writeText: async () => {} } }
  };

  vm.runInNewContext(fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8'), sandbox);
  await new Promise(r => setTimeout(r, 30));

  const triggerBtn = buttons.querySelector('.hyoumoji-trigger-btn');
  assert(Boolean(triggerBtn), 'Trigger button injected into comment box');

  triggerBtn.click();
  await new Promise(r => setTimeout(r, 40));

  const picker = body.querySelector('#hyoumoji-picker-container');
  const searchInput = picker.querySelector('.hyoumoji-search-input');
  const searchBtn = picker.querySelector('.hyoumoji-search-btn');
  const clearBtn = picker.querySelector('.hyoumoji-search-clear-btn');

  // 1. WhatsApp Emoji Tab & Simple Watermark
  assert(picker.querySelectorAll('.hyoumoji-tab-btn').length === 4, 'Unified UI has 4 tabs: Recent, Favs, Emojis, ASCII');
  assert(searchInput.placeholder === 'Search emoji', 'Simple search watermark: "Search emoji"');
  assert(picker.querySelectorAll('.hyoumoji-wa-icon-btn').length === 9, 'WhatsApp-style 9 SVG category icons rendered under search bar');

  // Switch WhatsApp category to Animals
  const waBtns = picker.querySelectorAll('.hyoumoji-wa-icon-btn');
  waBtns[2].click();
  await new Promise(r => setTimeout(r, 30));
  assert(picker.querySelectorAll('.hyoumoji-emoji-item').some(e => e.textContent === '🐶'), 'Animals SVG icon loads animal emojis');

  // Search emoji "fire"
  searchInput.value = 'fire';
  searchBtn.click();
  await new Promise(r => setTimeout(r, 30));
  assert(picker.querySelectorAll('.hyoumoji-emoji-item').some(e => e.textContent === '🔥'), 'Emoji search ("fire") returns 🔥');
  clearBtn.click();

  // 2. Unified ASCII Tab + Multi-Select Filter Tags
  const asciiTabBtn = picker.querySelectorAll('.hyoumoji-tab-btn').find(b => b.getAttribute('data-tab') === 'ascii');
  asciiTabBtn.click();
  await new Promise(r => setTimeout(r, 50));

  assert(searchInput.placeholder === 'Search ascii', 'Simple ASCII watermark: "Search ascii"');
  const tagBtns = picker.querySelectorAll('.hyoumoji-tag-btn');
  assert(tagBtns.map(b => b.textContent).join(',') === 'All,Single Line,Faces,Multiline,Braille',
    'ASCII filter tags match exact set: All, Single Line, Faces, Multiline, Braille');

  // Multi-select Faces + Multiline
  tagBtns.find(b => b.textContent === 'Faces').click();
  await new Promise(r => setTimeout(r, 40));
  tagBtns.find(b => b.textContent === 'Braille').click();
  await new Promise(r => setTimeout(r, 40));
  const activeTags = picker.querySelectorAll('.hyoumoji-tag-btn.active').map(b => b.textContent);
  assert(activeTags.includes('Faces') && activeTags.includes('Braille'), 'Multi-select allows Faces + Braille active simultaneously');

  // Reset to All & test "car" search relevance (real car BEFORE amoeba!)
  picker.querySelectorAll('.hyoumoji-tag-btn')[0].click();
  await new Promise(r => setTimeout(r, 40));
  searchInput.value = 'car';
  searchBtn.click();
  await new Promise(r => setTimeout(r, 40));
  const firstCarCard = picker.querySelectorAll('.hyoumoji-ascii-card')[0];
  assert(firstCarCard && !firstCarCard.querySelector('.hyoumoji-ascii-preview').textContent.includes('amoeba'),
    '"car" search returns actual cars first (not amoeba cartoon substring)');

  // Test "anime" search returns plenty of results (60 initial page + load more!)
  searchInput.value = 'anime';
  searchBtn.click();
  await new Promise(r => setTimeout(r, 40));
  const animeCards = picker.querySelectorAll('.hyoumoji-ascii-card');
  assert(animeCards.length === 60 && Boolean(picker.querySelector('.hyoumoji-load-more-btn')),
    '"anime" search returned full page (60+ results with Load More)');

  // Click an anime Braille card & verify insert
  animeCards[0].click();
  assert(editable.value.length > 50, 'Clicking fitted anime Braille card inserted full art into input');
  assert(picker.style.display === 'none', 'Picker closed after insert');

  console.log('\n====================================================');
  console.log(`🏁 SANDBOX TEST: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runSandboxTest().catch(err => {
  console.error(err);
  process.exit(1);
});
