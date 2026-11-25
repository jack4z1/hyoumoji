/**
 * hyoumoji - Emojis, ASCII Faces & ASCII Art
 * Context-aware expression picker for YouTube Comments, Shorts, Live Chat, Twitch, Kick, Rumble & TikTok.
 * 100% offline text library — zero external API calls, zero links, zero credentials.
 */

(function () {
  'use strict';

  const isYtLiveFrame = window.location.hostname.includes('youtube.com') &&
                        window.location.pathname.startsWith('/live_chat');
  if (window !== window.top && !isYtLiveFrame) return;

  const PLATFORM_CONTEXTS = {
    yt_long: {
      id: 'yt_long',
      label: '💬 YT Comment',
      maxChars: 10000,
      allowMultiline: true,
      maxWidth: 80,
      supportsAutoWrap: false,
      hint: 'Full multi-line ASCII & Braille art supported'
    },
    yt_short: {
      id: 'yt_short',
      label: '📱 YT Shorts',
      maxChars: 10000,
      allowMultiline: true,
      maxWidth: 32,
      supportsAutoWrap: false,
      hint: 'Filtered to ≤32 chars wide so art stays clean on mobile'
    },
    yt_live: {
      id: 'yt_live',
      label: '🔴 YT Live (200)',
      maxChars: 200,
      allowMultiline: false,
      maxWidth: 28,
      supportsAutoWrap: false,
      hint: 'Single-line only • 200 character limit'
    },
    twitch_live: {
      id: 'twitch_live',
      label: '🟣 Twitch (500)',
      maxChars: 500,
      allowMultiline: false,
      maxWidth: 30,
      supportsAutoWrap: true,
      hint: 'Single-line & Auto-Wrap Braille (≤500 chars)'
    },
    kick_live: {
      id: 'kick_live',
      label: '🟢 Kick (500)',
      maxChars: 500,
      allowMultiline: false,
      maxWidth: 30,
      supportsAutoWrap: true,
      hint: 'Single-line & Auto-Wrap Braille (≤500 chars)'
    },
    rumble_live: {
      id: 'rumble_live',
      label: '🟢 Rumble (200)',
      maxChars: 200,
      allowMultiline: false,
      maxWidth: 28,
      supportsAutoWrap: false,
      hint: 'Single-line only • 200 character limit'
    },
    tiktok_live: {
      id: 'tiktok_live',
      label: '🎵 TikTok (150)',
      maxChars: 150,
      allowMultiline: false,
      maxWidth: 28,
      supportsAutoWrap: false,
      hint: 'Single-line only • 150 character limit'
    }
  };

  const DEFAULT_PAGE_LIMITS = { emojis: 160, kaomoji: 80, ascii: 50 };
  const PAGE_STEP = { emojis: 160, kaomoji: 80, ascii: 50 };

  let activeEditable = null;
  let activeContext = PLATFORM_CONTEXTS.yt_long;
  let fitToSpace = true;
  let pickerModal = null;
  let activeTab = 'emojis';
  let activeSubFilter = 'all';
  let currentSearchQuery = '';
  let renderLimit = DEFAULT_PAGE_LIMITS.emojis;
  let activeRenderId = 0;

  const datasetCache = { emojis: null, kaomoji: null, ascii: null };
  const userStorage = {
    recents: { emojis: [], kaomoji: [], ascii: [] },
    favorites: { emojis: [], kaomoji: [], ascii: [] }
  };

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function getSafeExtensionUrl(path) {
    try {
      if (isContextValid() && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path);
      }
    } catch {}
    return '';
  }

  function detectPlatformContext(targetEl) {
    const host = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();

    if (host.includes('twitch.tv')) return PLATFORM_CONTEXTS.twitch_live;
    if (host.includes('kick.com')) return PLATFORM_CONTEXTS.kick_live;
    if (host.includes('rumble.com')) return PLATFORM_CONTEXTS.rumble_live;
    if (host.includes('tiktok.com')) return PLATFORM_CONTEXTS.tiktok_live;
    if (!host.includes('youtube.com')) return PLATFORM_CONTEXTS.yt_long;

    const inLiveChat = path.startsWith('/live_chat') || Boolean(
      targetEl?.closest?.('yt-live-chat-text-input-field-renderer, yt-live-chat-message-input-renderer, #chat-messages')
    );
    if (inLiveChat) return PLATFORM_CONTEXTS.yt_live;
    if (path.startsWith('/shorts')) return PLATFORM_CONTEXTS.yt_short;
    return PLATFORM_CONTEXTS.yt_long;
  }

  function isDarkPageTheme() {
    const html = document.documentElement;
    if (html.hasAttribute('dark') || html.classList.contains('tw-root--theme-dark') || html.classList.contains('dark')) {
      return true;
    }
    try {
      const bg = window.getComputedStyle(document.body || html).backgroundColor;
      const m = bg && bg.match(/\d+/g);
      if (m && m.length >= 3) {
        const lum = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]);
        if (lum < 128 && (!m[3] || +m[3] > 0)) return true;
        if (lum >= 128) return false;
      }
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  }

  function applyThemeClass(modal) {
    const dark = isDarkPageTheme();
    modal.classList.toggle('hyoumoji-theme-dark', dark);
    modal.classList.toggle('hyoumoji-theme-light', !dark);
  }

  // --- Storage (with automatic cleanup of legacy v1 keys) ---
  function normalizeBucket(raw) {
    return {
      emojis: Array.isArray(raw?.emojis) ? raw.emojis : [],
      kaomoji: Array.isArray(raw?.kaomoji) ? raw.kaomoji : [],
      ascii: Array.isArray(raw?.ascii) ? raw.ascii : []
    };
  }

  function loadUserStorage(callback) {
    try {
      if (!isContextValid() || !chrome.storage?.local) {
        if (callback) callback();
        return;
      }
      chrome.storage.local.remove(['hyoumoji_recents', 'hyoumoji_favorites', 'hyoumoji_link_protection']);
      chrome.storage.local.get(['hyoumoji_recents_v2', 'hyoumoji_favorites_v2'], (data) => {
        if (!chrome.runtime?.lastError) {
          if (data?.hyoumoji_recents_v2) userStorage.recents = normalizeBucket(data.hyoumoji_recents_v2);
          if (data?.hyoumoji_favorites_v2) userStorage.favorites = normalizeBucket(data.hyoumoji_favorites_v2);
        }
        if (callback) callback();
      });
    } catch {
      if (callback) callback();
    }
  }

  function persistBucket(storageKey, value) {
    try {
      if (isContextValid() && chrome.storage?.local) {
        chrome.storage.local.set({ [storageKey]: value });
      }
    } catch {}
  }

  function addRecent(type, value) {
    const list = (userStorage.recents[type] ||= []);
    const key = typeof value === 'string' ? value : value.t;
    userStorage.recents[type] = [
      value,
      ...list.filter(item => (typeof item === 'string' ? item : item.t) !== key)
    ].slice(0, 30);
    persistBucket('hyoumoji_recents_v2', userStorage.recents);
  }

  function isFavorited(type, key) {
    const list = userStorage.favorites[type];
    return Array.isArray(list) && list.some(item => (typeof item === 'string' ? item : item.t) === key);
  }

  function toggleFavorite(type, value) {
    const list = (userStorage.favorites[type] ||= []);
    const key = typeof value === 'string' ? value : value.t;
    const idx = list.findIndex(item => (typeof item === 'string' ? item : item.t) === key);

    if (idx > -1) {
      list.splice(idx, 1);
      showToast('Removed from Favorites');
      persistBucket('hyoumoji_favorites_v2', userStorage.favorites);
      return false;
    }

    list.unshift(value);
    if (list.length > 150) list.pop();
    showToast('Saved to Favorites');
    persistBucket('hyoumoji_favorites_v2', userStorage.favorites);
    return true;
  }

  function showToast(message) {
    let toast = document.getElementById('hyoumoji-toast-banner');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hyoumoji-toast-banner';
      toast.className = 'hyoumoji-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // --- Lazy Offline Loader (no-store prevents stale browser cache) ---
  async function loadDataset(name) {
    if (datasetCache[name]) return datasetCache[name];
    const fileMap = {
      emojis: 'data/emojis.json',
      kaomoji: 'data/kaomoji.json',
      ascii: 'data/ascii_art.json'
    };
    const url = getSafeExtensionUrl(fileMap[name]);
    if (!url) return [];
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      datasetCache[name] = Array.isArray(json) ? json : [];
      return datasetCache[name];
    } catch (err) {
      console.warn(`[hyoumoji] Could not load ${name}:`, err.message);
      return [];
    }
  }

  function fitsContext(item, ctx) {
    if (!fitToSpace) return true;
    const len = item.c || (item.t ? item.t.length : 0);
    const width = item.w || len;
    const isMulti = Boolean(item.m);
    const isBraille = Boolean(item.b);

    if (len > ctx.maxChars) return false;
    if (ctx.allowMultiline) return width <= ctx.maxWidth;
    if (!isMulti) return true;
    return Boolean(ctx.supportsAutoWrap && isBraille && width >= 20 && width <= ctx.maxWidth);
  }

  function prepareTextForInsert(item, ctx) {
    const rawText = typeof item === 'string' ? item : item.t;
    const useAutoWrap = Boolean(!ctx.allowMultiline && item?.m && item?.b && ctx.supportsAutoWrap);
    if (!useAutoWrap) return rawText;

    const lines = rawText.split('\n');
    const targetWidth = Math.min(28, Math.max(...lines.map(l => l.length)));
    return lines.map(line => line.padEnd(targetWidth, '⠀')).join('');
  }

  function copyToClipboardFallback(text) {
    if (!navigator.clipboard?.writeText) {
      showToast('Click a comment or chat box first');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied to clipboard (Ctrl+V to paste)'))
      .catch(() => showToast('Click a comment or chat box first'));
  }

  function insertTextIntoTarget(text) {
    if (!activeEditable || !activeEditable.isConnected) {
      copyToClipboardFallback(text);
      return;
    }

    activeEditable.focus();

    if (activeEditable.tagName === 'TEXTAREA' || activeEditable.tagName === 'INPUT') {
      const start = activeEditable.selectionStart ?? activeEditable.value.length;
      const end = activeEditable.selectionEnd ?? activeEditable.value.length;
      activeEditable.value = activeEditable.value.slice(0, start) + text + activeEditable.value.slice(end);
      const pos = start + text.length;
      activeEditable.setSelectionRange(pos, pos);
      activeEditable.dispatchEvent(new Event('input', { bubbles: true }));
      activeEditable.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }

    if (!inserted) insertViaSelectionRange(activeEditable, text);
    activeEditable.dispatchEvent(new Event('input', { bubbles: true }));
    activeEditable.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function insertViaSelectionRange(editable, text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editable.textContent += text;
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // --- Modal Shell & Search Controls ---
  function createPickerModal() {
    const existing = document.getElementById('hyoumoji-picker-container');
    if (existing) return existing;

    const modal = document.createElement('div');
    modal.id = 'hyoumoji-picker-container';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'hyoumoji expression picker');
    modal.style.display = 'none';

    const iconUrl = getSafeExtensionUrl('icons/icon48.png');
    modal.innerHTML = `
      <div class="hyoumoji-header">
        <div class="hyoumoji-title">
          ${iconUrl ? `<img src="${iconUrl}" class="hyoumoji-header-icon" alt="" />` : ''}
          <span>hyoumoji</span>
          <span class="hyoumoji-context-pill" id="hyoumoji-context-badge"></span>
        </div>
        <div class="hyoumoji-header-actions">
          <button type="button" class="hyoumoji-fit-toggle active" id="hyoumoji-fit-btn" aria-pressed="true" title="Filter results to fit current chat or comment box">Fit Space</button>
          <button type="button" class="hyoumoji-close-btn" aria-label="Close picker" title="Close (Esc)">✕</button>
        </div>
      </div>

      <div class="hyoumoji-tabs" role="tablist" aria-label="Expression categories">
        <button type="button" class="hyoumoji-tab-btn" data-tab="recent" role="tab" aria-selected="false">Recent</button>
        <button type="button" class="hyoumoji-tab-btn" data-tab="favorites" role="tab" aria-selected="false">Favs</button>
        <button type="button" class="hyoumoji-tab-btn active" data-tab="emojis" role="tab" aria-selected="true">Emojis</button>
        <button type="button" class="hyoumoji-tab-btn" data-tab="kaomoji" role="tab" aria-selected="false" title="ASCII Faces">ASCII Faces</button>
        <button type="button" class="hyoumoji-tab-btn" data-tab="ascii" role="tab" aria-selected="false" title="ASCII & Braille Art">ASCII Art</button>
      </div>

      <div class="hyoumoji-search-container">
        <div class="hyoumoji-search-group">
          <input type="text" class="hyoumoji-search-input" aria-label="Search expressions" placeholder="Search emojis, ASCII faces & ASCII art..." />
          <button type="button" class="hyoumoji-search-clear-btn" aria-label="Clear search" title="Clear" style="display:none;">✕</button>
          <button type="button" class="hyoumoji-search-btn" aria-label="Search" title="Search">🔍</button>
        </div>
      </div>

      <div class="hyoumoji-chips-row" id="hyoumoji-chips-container"></div>
      <div class="hyoumoji-body" id="hyoumoji-tab-content"></div>

      <div class="hyoumoji-footer-tip">
        <span id="hyoumoji-footer-hint">100% Native Text • Zero Links</span>
        <span class="hyoumoji-brand-tag">hyoumoji</span>
      </div>
    `;

    document.body.appendChild(modal);
    bindModalEvents(modal);
    return modal;
  }

  function bindModalEvents(modal) {
    const searchInput = modal.querySelector('.hyoumoji-search-input');
    const clearBtn = modal.querySelector('.hyoumoji-search-clear-btn');
    const searchBtn = modal.querySelector('.hyoumoji-search-btn');
    const fitBtn = modal.querySelector('#hyoumoji-fit-btn');
    let debounceTimer = null;

    const runSearch = () => {
      clearTimeout(debounceTimer);
      currentSearchQuery = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = searchInput.value ? 'inline-flex' : 'none';
      renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
      renderTabContent();
    };

    modal.querySelector('.hyoumoji-close-btn').addEventListener('click', closePicker);

    fitBtn.addEventListener('click', () => {
      fitToSpace = !fitToSpace;
      fitBtn.classList.toggle('active', fitToSpace);
      fitBtn.setAttribute('aria-pressed', String(fitToSpace));
      fitBtn.textContent = fitToSpace ? 'Fit Space' : 'Show All';
      renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
      renderTabContent();
    });

    modal.querySelectorAll('.hyoumoji-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.hyoumoji-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        activeTab = btn.getAttribute('data-tab');
        activeSubFilter = 'all';
        renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
        renderTabContent();
      });
    });

    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline-flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 180);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });

    searchBtn.addEventListener('click', runSearch);
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      runSearch();
      searchInput.focus();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') closePicker();
    });

    document.addEventListener('mousedown', (e) => {
      if (modal.style.display === 'none') return;
      if (!modal.contains(e.target) && !e.target.closest('.hyoumoji-trigger-btn')) {
        closePicker();
      }
    });
  }

  function openPicker(triggerBtn, editable) {
    if (!pickerModal) pickerModal = createPickerModal();

    activeEditable = editable;
    activeContext = detectPlatformContext(editable);
    applyThemeClass(pickerModal);

    const badge = pickerModal.querySelector('#hyoumoji-context-badge');
    const hint = pickerModal.querySelector('#hyoumoji-footer-hint');
    if (badge) badge.textContent = activeContext.label;
    if (hint) hint.textContent = activeContext.hint;

    const rect = triggerBtn.getBoundingClientRect();
    const modalWidth = Math.min(440, window.innerWidth - 16);
    const modalHeight = Math.min(500, window.innerHeight - 20);

    let left = Math.min(rect.left, window.innerWidth - modalWidth - 8);
    left = Math.max(8, left);

    let top = rect.bottom + window.scrollY + 8;
    if (rect.bottom + modalHeight > window.innerHeight && rect.top > modalHeight) {
      top = rect.top + window.scrollY - modalHeight - 8;
    }

    pickerModal.style.left = `${left}px`;
    pickerModal.style.top = `${Math.max(8, top)}px`;
    pickerModal.style.display = 'flex';

    renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
    renderTabContent();

    setTimeout(() => pickerModal.querySelector('.hyoumoji-search-input')?.focus(), 60);
  }

  function closePicker() {
    if (!pickerModal) return;
    pickerModal.style.display = 'none';
    currentSearchQuery = '';
    const input = pickerModal.querySelector('.hyoumoji-search-input');
    const clearBtn = pickerModal.querySelector('.hyoumoji-search-clear-btn');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    // Release heavy expression arrays when modal closes so idle memory stays minimal
    datasetCache.kaomoji = null;
    datasetCache.ascii = null;
  }

  // --- Shared UI Helpers ---
  function renderChips(chipsContainer, defs) {
    if (!chipsContainer) return;
    defs.forEach(chipDef => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `hyoumoji-chip ${activeSubFilter === chipDef.id ? 'active' : ''}`;
      chip.textContent = chipDef.label;
      chip.addEventListener('click', () => {
        activeSubFilter = chipDef.id;
        renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
        renderTabContent();
      });
      chipsContainer.appendChild(chip);
    });
  }

  function renderLoadMore(container, remaining, step) {
    if (remaining <= 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'hyoumoji-pagination-loader';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hyoumoji-load-more-btn';
    btn.textContent = `Load More (${remaining.toLocaleString()} remaining)`;
    btn.addEventListener('click', () => {
      renderLimit += step;
      renderTabContent();
    });
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }

  function renderEmptyState(container, icon, titleText, descText) {
    const box = document.createElement('div');
    box.className = 'hyoumoji-status-box';
    const ico = document.createElement('span');
    ico.className = 'hyoumoji-status-icon';
    ico.textContent = icon;
    const title = document.createElement('strong');
    title.textContent = titleText;
    const desc = document.createElement('p');
    desc.textContent = descText;
    box.append(ico, title, desc);
    container.appendChild(box);
  }

  function createEmojiButton(emojiObj) {
    const emojiChar = typeof emojiObj === 'string' ? emojiObj : emojiObj.e;
    const keywords = typeof emojiObj === 'string' ? '' : (emojiObj.k || '');

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'hyoumoji-emoji-item';
    item.textContent = emojiChar;
    item.title = keywords ? `${emojiChar} — ${keywords.split(' ').slice(0, 5).join(', ')}` : emojiChar;
    item.setAttribute('aria-label', keywords ? keywords.split(' ').slice(0, 3).join(' ') : emojiChar);
    item.addEventListener('click', () => {
      insertTextIntoTarget(emojiChar);
      addRecent('emojis', emojiChar);
    });
    return item;
  }

  function createMiniBadge(text, extraClass = '') {
    const badge = document.createElement('span');
    badge.className = extraClass ? `hyoumoji-mini-badge ${extraClass}` : 'hyoumoji-mini-badge';
    badge.textContent = text;
    return badge;
  }

  function createExpressionCard(item, storageType) {
    const rawText = typeof item === 'string' ? item : item.t;
    const isMulti = Boolean(item.m);
    const isBraille = Boolean(item.b);
    const charCount = item.c || rawText.length;
    const width = item.w || charCount;
    const isAutoWrap = !activeContext.allowMultiline && isMulti && isBraille && activeContext.supportsAutoWrap;

    const card = document.createElement('div');
    card.className = `hyoumoji-expr-card ${isMulti ? 'is-multiline' : 'is-singleline'}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', item.k ? `Insert ${item.k.split(' ').slice(0, 4).join(' ')}` : 'Insert expression');

    const preview = document.createElement('pre');
    preview.className = `hyoumoji-expr-preview ${isBraille ? 'is-braille' : ''}`;
    preview.textContent = rawText;

    const metaRow = document.createElement('div');
    metaRow.className = 'hyoumoji-expr-meta';

    const badges = document.createElement('div');
    badges.className = 'hyoumoji-expr-badges';
    badges.appendChild(createMiniBadge(`${charCount}c`));
    if (isAutoWrap) badges.appendChild(createMiniBadge('Auto-Wrap', 'is-autowrap'));
    else if (!isMulti) badges.appendChild(createMiniBadge('1-Line', 'is-safe'));
    else if (!activeContext.allowMultiline) badges.appendChild(createMiniBadge('Multi-line', 'is-warn'));
    else if (width <= 32) badges.appendChild(createMiniBadge('Mobile OK', 'is-safe'));

    const actions = document.createElement('div');
    actions.className = 'hyoumoji-expr-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'hyoumoji-mini-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy to clipboard');
    copyBtn.textContent = '📋';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboardFallback(prepareTextForInsert(item, activeContext));
    });

    const fav = isFavorited(storageType, rawText);
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `hyoumoji-mini-btn ${fav ? 'is-fav' : ''}`;
    starBtn.title = fav ? 'Remove favorite' : 'Add to favorites';
    starBtn.setAttribute('aria-label', starBtn.title);
    starBtn.setAttribute('aria-pressed', String(fav));
    starBtn.textContent = fav ? '★' : '☆';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = toggleFavorite(storageType, item);
      starBtn.classList.toggle('is-fav', added);
      starBtn.setAttribute('aria-pressed', String(added));
      starBtn.textContent = added ? '★' : '☆';
      if (activeTab === 'favorites') renderTabContent();
    });

    const activateCard = () => {
      insertTextIntoTarget(prepareTextForInsert(item, activeContext));
      addRecent(storageType, item);
      closePicker();
    };

    actions.append(copyBtn, starBtn);
    metaRow.append(badges, actions);
    card.append(preview, metaRow);

    card.addEventListener('click', activateCard);
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target !== card) return;
      e.preventDefault();
      activateCard();
    });

    return card;
  }

  function renderLoadingState(container, label) {
    const box = document.createElement('div');
    box.className = 'hyoumoji-status-box';
    const spinner = document.createElement('div');
    spinner.className = 'hyoumoji-spinner';
    const text = document.createElement('span');
    text.textContent = label;
    box.append(spinner, text);
    container.appendChild(box);
  }

  // --- Tabs ---
  async function renderTabContent() {
    if (!pickerModal) return;
    const renderId = ++activeRenderId;
    try {
      const container = pickerModal.querySelector('#hyoumoji-tab-content');
      const chipsContainer = pickerModal.querySelector('#hyoumoji-chips-container');
      const searchInput = pickerModal.querySelector('.hyoumoji-search-input');
      if (!container) return;

      if (chipsContainer) chipsContainer.innerHTML = '';
      container.innerHTML = '';

      if (searchInput) {
        const placeholders = {
          recent: 'Filter recents...',
          favorites: 'Filter favorites...',
          emojis: 'Search emojis (e.g. fire, skull, laugh, cat)...',
          kaomoji: 'Search 36,000+ ASCII faces (e.g. happy, love, angry, bear)...',
          ascii: 'Search ASCII & Braille art (e.g. pikachu, sword, cat, rose)...'
        };
        searchInput.placeholder = placeholders[activeTab] || 'Search...';
      }

      if (activeTab === 'recent') renderRecentTab(container);
      else if (activeTab === 'favorites') renderFavoritesTab(container);
      else if (activeTab === 'emojis') await renderEmojisTab(container, chipsContainer, renderId);
      else if (activeTab === 'kaomoji') await renderKaomojiTab(container, chipsContainer, renderId);
      else if (activeTab === 'ascii') await renderAsciiTab(container, chipsContainer, renderId);
    } catch (err) {
      console.warn('[hyoumoji] Tab render notice:', err);
    }
  }

  function appendExpressionSection(container, titleText, items, storageType, gridClass) {
    if (!items.length) return;
    const title = document.createElement('div');
    title.className = 'hyoumoji-section-title';
    title.textContent = titleText;
    const grid = document.createElement('div');
    grid.className = gridClass;
    items.forEach(item => grid.appendChild(createExpressionCard(item, storageType)));
    container.append(title, grid);
  }

  function renderRecentTab(container) {
    const q = currentSearchQuery;
    const emojis = (userStorage.recents.emojis || []).filter(e => !q || e.includes(q));
    const kaomoji = (userStorage.recents.kaomoji || []).filter(k => fitsContext(k, activeContext) && (!q || (k.k || '').includes(q) || (k.t || '').includes(q)));
    const ascii = (userStorage.recents.ascii || []).filter(a => fitsContext(a, activeContext) && (!q || (a.k || '').includes(q) || (a.t || '').includes(q)));

    if (!emojis.length && !kaomoji.length && !ascii.length) {
      renderEmptyState(container, '🕒', 'No recents yet', 'Emojis, ASCII faces, and ASCII art you pick appear here.');
      return;
    }

    if (emojis.length) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = 'Recent Emojis';
      const grid = document.createElement('div');
      grid.className = 'hyoumoji-emoji-grid';
      emojis.forEach(e => grid.appendChild(createEmojiButton(e)));
      container.append(title, grid);
    }

    appendExpressionSection(container, 'Recent ASCII Faces', kaomoji, 'kaomoji', 'hyoumoji-expr-grid');
    appendExpressionSection(container, 'Recent ASCII Art', ascii, 'ascii', 'hyoumoji-ascii-list');
  }

  function renderFavoritesTab(container) {
    const q = currentSearchQuery;
    const kaomoji = (userStorage.favorites.kaomoji || []).filter(k => !q || (k.k || '').includes(q) || (k.t || '').includes(q));
    const ascii = (userStorage.favorites.ascii || []).filter(a => !q || (a.k || '').includes(q) || (a.t || '').includes(q));

    if (!kaomoji.length && !ascii.length) {
      renderEmptyState(container, '⭐', 'No favorites saved yet', 'Click ☆ on any ASCII face or ASCII art to save it here.');
      return;
    }

    appendExpressionSection(container, `Saved ASCII Faces (${kaomoji.length})`, kaomoji, 'kaomoji', 'hyoumoji-expr-grid');
    appendExpressionSection(container, `Saved ASCII Art (${ascii.length})`, ascii, 'ascii', 'hyoumoji-ascii-list');
  }

  const EMOJI_FILTER_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'face smile laugh', label: '😂 Smileys' },
    { id: 'heart love kiss', label: '❤️ Love' },
    { id: 'fire star sparkle rocket 100', label: '🔥 Hype' },
    { id: 'hand thumb clap pray', label: '👍 Hands' },
    { id: 'animal cat dog bear', label: '🐱 Animals' },
    { id: 'food drink pizza coffee', label: '🍕 Food' },
    { id: 'game music party trophy', label: '🎮 Gaming' }
  ];

  async function renderEmojisTab(container, chipsContainer, renderId) {
    renderChips(chipsContainer, EMOJI_FILTER_CHIPS);
    if (!datasetCache.emojis) renderLoadingState(container, 'Loading emojis...');
    const allEmojis = await loadDataset('emojis');
    if (renderId !== activeRenderId) return;
    container.innerHTML = '';
    const q = currentSearchQuery;

    let filtered = allEmojis;
    if (activeSubFilter !== 'all') {
      const terms = activeSubFilter.split(' ');
      filtered = filtered.filter(item => terms.some(t => item.k.includes(t)));
    }
    if (q) {
      const qTerms = q.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(item => item.e === q || qTerms.every(t => item.k.includes(t)));
    }

    const banner = document.createElement('div');
    banner.className = 'hyoumoji-results-count-banner';
    banner.textContent = `${filtered.length} emojis${q ? ` matching "${q}"` : ''}`;
    container.appendChild(banner);

    if (!filtered.length) {
      renderEmptyState(container, '🔍', 'No emojis found', `No match for "${q}". Try "fire", "laugh", "heart", or "cat".`);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-emoji-grid';
    const slice = filtered.slice(0, renderLimit);
    slice.forEach(item => grid.appendChild(createEmojiButton(item)));
    container.appendChild(grid);
    renderLoadMore(container, filtered.length - slice.length, PAGE_STEP.emojis);
  }

  const KAOMOJI_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'happy', label: '😊 Happy' },
    { id: 'love', label: '❤️ Love' },
    { id: 'angry', label: '💢 Angry' },
    { id: 'sad', label: '😢 Sad' },
    { id: 'cute', label: '🌸 Cute' },
    { id: 'shrug', label: '🤷 Shrug' },
    { id: 'bear', label: 'ʕ•ᴥ•ʔ Bear' },
    { id: 'cat', label: '🐱 Cat' },
    { id: 'table', label: '┻━┻ Flip' }
  ];

  async function renderKaomojiTab(container, chipsContainer, renderId) {
    renderChips(chipsContainer, KAOMOJI_CHIPS);
    if (!datasetCache.kaomoji) renderLoadingState(container, 'Loading 36,000+ ASCII faces...');
    const allKaomoji = await loadDataset('kaomoji');
    if (renderId !== activeRenderId) return;
    container.innerHTML = '';
    const q = currentSearchQuery;

    let filtered = allKaomoji.filter(item => fitsContext(item, activeContext));
    if (activeSubFilter !== 'all') {
      filtered = filtered.filter(item => item.k.includes(activeSubFilter) || item.t.includes(activeSubFilter));
    }
    if (q) {
      const qTerms = q.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(item => qTerms.every(t => item.k.includes(t) || item.t.toLowerCase().includes(t)));
    }

    const banner = document.createElement('div');
    banner.className = 'hyoumoji-results-count-banner';
    banner.textContent = `${filtered.length.toLocaleString()} ASCII faces fit ${activeContext.label}`;
    container.appendChild(banner);

    if (!filtered.length) {
      renderEmptyState(container, '🔍', 'No ASCII faces found', `No match for "${q}" in ${activeContext.label}.`);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-expr-grid';
    const slice = filtered.slice(0, renderLimit);
    slice.forEach(item => grid.appendChild(createExpressionCard(item, 'kaomoji')));
    container.appendChild(grid);
    renderLoadMore(container, filtered.length - slice.length, PAGE_STEP.kaomoji);
  }

  const ASCII_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'one-line', label: '⚡ 1-Line' },
    { id: 'braille', label: '⣿ Braille' },
    { id: 'anime', label: '🎌 Anime' },
    { id: 'combos', label: '✨ Combos' },
    { id: 'animals', label: '🐾 Animals' },
    { id: 'love', label: '❤️ Love' },
    { id: 'objects', label: '⚔️ Objects' },
    { id: 'classic', label: '🖼️ Classic' }
  ];

  function matchesAsciiSubFilter(item, subFilter) {
    if (subFilter === 'all') return true;
    if (subFilter === 'one-line') return item.m === 0 || item.cat === 'one-line';
    if (subFilter === 'braille') return item.b === 1 || item.cat === 'braille';
    return item.cat === subFilter || item.k.includes(subFilter);
  }

  async function renderAsciiTab(container, chipsContainer, renderId) {
    renderChips(chipsContainer, ASCII_CHIPS);
    if (!datasetCache.ascii) renderLoadingState(container, 'Loading ASCII & Braille art...');
    const allAscii = await loadDataset('ascii');
    if (renderId !== activeRenderId) return;
    container.innerHTML = '';
    const q = currentSearchQuery;

    let filtered = allAscii.filter(item => fitsContext(item, activeContext) && matchesAsciiSubFilter(item, activeSubFilter));
    if (q) {
      const qTerms = q.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(item => qTerms.every(t => item.k.includes(t) || item.t.toLowerCase().includes(t)));
    }

    if (!activeContext.allowMultiline || activeContext.id === 'yt_short') {
      filtered.sort((a, b) => (a.m - b.m) || (a.w - b.w));
    }

    const banner = document.createElement('div');
    banner.className = 'hyoumoji-results-count-banner';
    banner.textContent = `${filtered.length.toLocaleString()} ASCII & Braille items fit ${activeContext.label}`;
    container.appendChild(banner);

    if (!filtered.length) {
      const msg = (fitToSpace && !activeContext.allowMultiline)
        ? 'Multi-line art is hidden in this single-line live chat. Try "1-Line" or click "Show All" to copy.'
        : `No ASCII art found for "${q}".`;
      renderEmptyState(container, '🎨', 'Nothing fits this filter', msg);
      return;
    }

    const list = document.createElement('div');
    list.className = 'hyoumoji-ascii-list';
    const slice = filtered.slice(0, renderLimit);
    slice.forEach(item => list.appendChild(createExpressionCard(item, 'ascii')));
    container.appendChild(list);
    renderLoadMore(container, filtered.length - slice.length, PAGE_STEP.ascii);
  }

  // --- Platform Input Injection ---
  function createTriggerButton(editable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hyoumoji-trigger-btn';
    btn.title = 'Open hyoumoji (Emojis, ASCII Faces & ASCII Art)';
    btn.setAttribute('aria-label', 'Open hyoumoji picker');

    const iconUrl = getSafeExtensionUrl('icons/icon48.png');
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.className = 'hyoumoji-btn-sticker-icon';
      img.alt = '';
      btn.appendChild(img);
    }

    const label = document.createElement('span');
    label.textContent = 'hyoumoji';
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(btn, editable);
    });
    return btn;
  }

  function injectYouTubeComments() {
    document.querySelectorAll('ytd-commentbox, ytd-comment-simplebox-renderer').forEach(box => {
      if (box.hasAttribute('data-hyoumoji-injected')) return;
      const editable = box.querySelector('div#contenteditable-root') || box.querySelector('[contenteditable="true"]');
      const buttonsArea = box.querySelector('#buttons, #footer, #action-buttons');
      if (!editable || !buttonsArea || box.querySelector('.hyoumoji-trigger-btn')) return;

      box.setAttribute('data-hyoumoji-injected', 'true');
      const btn = createTriggerButton(editable);
      const nativeEmojiBtn = buttonsArea.querySelector('#emoji-button');
      if (nativeEmojiBtn?.parentNode) nativeEmojiBtn.parentNode.insertBefore(btn, nativeEmojiBtn);
      else buttonsArea.prepend(btn);
    });
  }

  function injectYouTubeLiveChat() {
    const liveInput = document.querySelector('yt-live-chat-text-input-field-renderer #input');
    const actionButtons = document.querySelector('yt-live-chat-message-input-renderer #interaction-message, yt-live-chat-message-input-renderer #buttons');
    if (!liveInput || !actionButtons || actionButtons.querySelector('.hyoumoji-trigger-btn')) return;

    const btn = createTriggerButton(liveInput);
    btn.classList.add('is-compact');
    actionButtons.prepend(btn);
  }

  function injectStreamChat() {
    const host = (window.location.hostname || '').toLowerCase();
    let editable = null;
    let targetBar = null;

    if (host.includes('twitch.tv')) {
      editable = document.querySelector('[data-a-target="chat-input"]');
      targetBar = document.querySelector('[data-test-selector="chat-input-buttons-container"]') ||
                  editable?.closest('.chat-input')?.querySelector('.tw-flex');
    } else if (host.includes('kick.com')) {
      editable = document.querySelector('#message-input, [data-testid="chat-input"], [contenteditable="true"]');
      targetBar = editable?.parentElement?.parentElement;
    } else if (host.includes('rumble.com')) {
      editable = document.querySelector('#chat-message-text-input, textarea[name="message"]');
      targetBar = editable?.parentElement;
    } else if (host.includes('tiktok.com')) {
      editable = document.querySelector('[data-e2e="comment-input"] [contenteditable="true"], [contenteditable="true"]');
      targetBar = editable?.parentElement;
    }

    if (!editable || !targetBar || targetBar.querySelector('.hyoumoji-trigger-btn')) return;
    const btn = createTriggerButton(editable);
    btn.classList.add('is-compact');
    targetBar.prepend(btn);
  }

  function scanForInputs() {
    if ((window.location.hostname || '').toLowerCase().includes('youtube.com')) {
      injectYouTubeComments();
      injectYouTubeLiveChat();
      return;
    }
    injectStreamChat();
  }

  let scanDebounceTimer = null;
  function scheduleScan() {
    if (!isContextValid()) {
      try { observer.disconnect(); } catch {}
      return;
    }
    if (scanDebounceTimer) return;
    scanDebounceTimer = setTimeout(() => {
      scanDebounceTimer = null;
      scanForInputs();
    }, 180);
  }

  const observer = new MutationObserver(scheduleScan);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('yt-navigate-finish', () => setTimeout(scheduleScan, 600));

  loadUserStorage(() => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanForInputs);
    else scanForInputs();
  });
})();
