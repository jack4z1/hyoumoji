/**
 * hyoumoji - Emojis & ASCII Picker
 * Context-aware expression picker for YouTube Comments, Shorts, Live Chat, Twitch, Kick, Rumble & TikTok.
 * 100% offline text library — zero external API calls, zero links, zero credentials.
 */

(function () {
  'use strict';

  const isYtLiveFrame = window.location.hostname.includes('youtube.com') &&
                        window.location.pathname.startsWith('/live_chat');
  if (window !== window.top && !isYtLiveFrame) return;

  const PLATFORM_CONTEXTS = {
    yt_long: { id: 'yt_long', label: 'YT Comment', maxChars: 10000, allowMultiline: true, maxWidth: 120, supportsAutoWrap: false, hint: 'YouTube Comment • Multi-line supported' },
    yt_short: { id: 'yt_short', label: 'YT Shorts', maxChars: 10000, allowMultiline: true, maxWidth: 32, supportsAutoWrap: false, hint: 'YT Shorts • Mobile-safe width (≤32)' },
    yt_live: { id: 'yt_live', label: 'YT Live (200)', maxChars: 200, allowMultiline: false, maxWidth: 28, supportsAutoWrap: false, hint: 'YT Live Chat • Single-line, 200 max' },
    twitch_live: { id: 'twitch_live', label: 'Twitch (500)', maxChars: 500, allowMultiline: false, maxWidth: 30, supportsAutoWrap: true, hint: 'Twitch Chat • Single-line & Auto-Wrap (500 max)' },
    kick_live: { id: 'kick_live', label: 'Kick (500)', maxChars: 500, allowMultiline: false, maxWidth: 30, supportsAutoWrap: true, hint: 'Kick Chat • Single-line & Auto-Wrap (500 max)' },
    rumble_live: { id: 'rumble_live', label: 'Rumble (200)', maxChars: 200, allowMultiline: false, maxWidth: 28, supportsAutoWrap: false, hint: 'Rumble Live • Single-line, 200 max' },
    tiktok_live: { id: 'tiktok_live', label: 'TikTok (150)', maxChars: 150, allowMultiline: false, maxWidth: 28, supportsAutoWrap: false, hint: 'TikTok Live • Single-line, 150 max' }
  };

  // WhatsApp-style monochrome SVG icons (zero colorful emojis in UI chrome)
  const SVG_ICONS = {
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    clear: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    recent: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
    smileys: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    animals: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="7" r="2.2"/><circle cx="12" cy="13" r="6"/><circle cx="10" cy="12" r=".6" fill="currentColor"/><circle cx="14" cy="12" r=".6" fill="currentColor"/><path d="M10.5 15h3"/></svg>',
    food: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h11v6a5 5 0 0 1-11 0V9z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><line x1="4" y1="20" x2="17" y2="20"/></svg>',
    activities: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="12 7.5 15.5 10 14.2 14.5 9.8 14.5 8.5 10"/></svg>',
    travel: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l1.5-5h11L19 12"/><rect x="3" y="12" width="18" height="5" rx="1.5"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></svg>',
    objects: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.3 1.2 2.1h4.6c.1-.8.5-1.6 1.2-2.1A6 6 0 0 0 12 3z"/></svg>',
    symbols: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 8.5v4.5m0 2.5v.2m4-6.2a1.7 1.7 0 0 1 3 .9c0 1.2-1.5 1.4-1.5 2.6m0 2.5v.2m3.8-7v7m2.4-7v7"/></svg>',
    flags: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 5h12l-2 4 2 4H5"/></svg>'
  };

  const WHATSAPP_EMOJI_TABS = [
    { id: 'recent', label: 'Recent emojis', svg: SVG_ICONS.recent },
    { id: 'smileys', label: 'Smileys & People', svg: SVG_ICONS.smileys },
    { id: 'animals', label: 'Animals & Nature', svg: SVG_ICONS.animals },
    { id: 'food', label: 'Food & Drink', svg: SVG_ICONS.food },
    { id: 'activities', label: 'Activities', svg: SVG_ICONS.activities },
    { id: 'travel', label: 'Travel & Places', svg: SVG_ICONS.travel },
    { id: 'objects', label: 'Objects', svg: SVG_ICONS.objects },
    { id: 'symbols', label: 'Symbols', svg: SVG_ICONS.symbols },
    { id: 'flags', label: 'Flags', svg: SVG_ICONS.flags }
  ];

  const ASCII_FILTER_TAGS = [
    { id: 'all', label: 'All' },
    { id: 'single', label: 'Single Line' },
    { id: 'faces', label: 'Faces' },
    { id: 'multiline', label: 'Multiline' },
    { id: 'braille', label: 'Braille' }
  ];

  const DEFAULT_PAGE_LIMITS = { emojis: 240, ascii: 60 };
  const PAGE_STEP = { emojis: 240, ascii: 60 };

  let activeEditable = null;
  let activeContext = PLATFORM_CONTEXTS.yt_long;
  let fitToSpace = true;
  let pickerModal = null;
  let activeTab = 'emojis';
  let activeEmojiGroup = 'smileys';
  let selectedAsciiTags = new Set(['all']);
  let currentSearchQuery = '';
  let renderLimit = DEFAULT_PAGE_LIMITS.emojis;
  let activeRenderId = 0;

  const datasetCache = { emojis: null, ascii: null };
  const userStorage = {
    recents: { emojis: [], ascii: [] },
    favorites: { emojis: [], ascii: [] }
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
      if (isContextValid() && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
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

  // --- Storage (purges stale v1 keys automatically) ---
  function normalizeBucket(raw) {
    return {
      emojis: Array.isArray(raw?.emojis) ? raw.emojis : [],
      ascii: Array.isArray(raw?.ascii) ? raw.ascii : []
    };
  }

  function loadUserStorage(callback) {
    try {
      if (!isContextValid() || !chrome.storage?.local) {
        if (callback) callback();
        return;
      }
      chrome.storage.local.remove(['hyoumoji_recents', 'hyoumoji_favorites', 'hyoumoji_link_protection', 'hyoumoji_recents_v2', 'hyoumoji_favorites_v2']);
      chrome.storage.local.get(['hyoumoji_recents_v3', 'hyoumoji_favorites_v3'], (data) => {
        if (!chrome.runtime?.lastError) {
          if (data?.hyoumoji_recents_v3) userStorage.recents = normalizeBucket(data.hyoumoji_recents_v3);
          if (data?.hyoumoji_favorites_v3) userStorage.favorites = normalizeBucket(data.hyoumoji_favorites_v3);
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
    ].slice(0, 32);
    persistBucket('hyoumoji_recents_v3', userStorage.recents);
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
      showToast('Removed from Favs');
      persistBucket('hyoumoji_favorites_v3', userStorage.favorites);
      return false;
    }

    list.unshift(value);
    if (list.length > 150) list.pop();
    showToast('Saved to Favs');
    persistBucket('hyoumoji_favorites_v3', userStorage.favorites);
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
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // --- Offline Loader (no-store prevents stale cache) ---
  async function loadDataset(name) {
    if (datasetCache[name]) return datasetCache[name];
    const fileMap = { emojis: 'data/emojis.json', ascii: 'data/ascii.json' };
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

  function insertTextIntoTarget(text) {
    if (!activeEditable || !activeEditable.isConnected) {
      navigator.clipboard?.writeText?.(text).then(() => showToast('Copied to clipboard'));
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

  // --- Search Relevance Scorer (whole-word title matches first, never buries cars/anime under unrelated text) ---
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function scoreAsciiMatch(item, terms) {
    const kw = item.k || '';
    let score = 0;
    for (const term of terms) {
      const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (rx.test(kw)) {
        score += 100;
      } else if (kw.includes(term)) {
        score += 30;
      } else if (item.c <= 80 && (item.t || '').toLowerCase().includes(term)) {
        score += 10;
      } else {
        return 0;
      }
    }
    return score;
  }

  function matchesAsciiTags(item, tagsSet) {
    if (tagsSet.has('all') || tagsSet.size === 0) return true;
    if (tagsSet.has('single') && item.m === 0) return true;
    if (tagsSet.has('faces') && item.f === 1) return true;
    if (tagsSet.has('multiline') && item.m === 1) return true;
    if (tagsSet.has('braille') && item.b === 1) return true;
    return false;
  }

  // --- Modal Shell ---
  function createPickerModal() {
    const existing = document.getElementById('hyoumoji-picker-container');
    if (existing) return existing;

    const modal = document.createElement('div');
    modal.id = 'hyoumoji-picker-container';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'hyoumoji picker');
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
          <button type="button" class="hyoumoji-fit-toggle active" id="hyoumoji-fit-btn" aria-pressed="true" title="Filter items that fit the current input box">Fit Space</button>
          <button type="button" class="hyoumoji-close-btn" aria-label="Close" title="Close (Esc)">${SVG_ICONS.clear}</button>
        </div>
      </div>

      <div class="hyoumoji-tabs" role="tablist" aria-label="Categories">
        <button type="button" class="hyoumoji-tab-btn" data-tab="recent" role="tab" aria-selected="false">Recent</button>
        <button type="button" class="hyoumoji-tab-btn" data-tab="favorites" role="tab" aria-selected="false">Favs</button>
        <button type="button" class="hyoumoji-tab-btn active" data-tab="emojis" role="tab" aria-selected="true">Emojis</button>
        <button type="button" class="hyoumoji-tab-btn" data-tab="ascii" role="tab" aria-selected="false">ASCII</button>
      </div>

      <div class="hyoumoji-search-container">
        <div class="hyoumoji-search-group">
          <input type="text" class="hyoumoji-search-input" aria-label="Search" placeholder="Search emoji" />
          <button type="button" class="hyoumoji-search-clear-btn" aria-label="Clear search" title="Clear" style="display:none;">${SVG_ICONS.clear}</button>
          <button type="button" class="hyoumoji-search-btn" aria-label="Search" title="Search">${SVG_ICONS.search}</button>
        </div>
      </div>

      <div class="hyoumoji-subbar" id="hyoumoji-subbar-container"></div>
      <div class="hyoumoji-body" id="hyoumoji-tab-content"></div>

      <div class="hyoumoji-footer-tip">
        <span id="hyoumoji-footer-hint">Pure text • Zero links</span>
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
        renderLimit = DEFAULT_PAGE_LIMITS[activeTab] || 80;
        renderTabContent();
      });
    });

    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline-flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 160);
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
    setTimeout(() => pickerModal.querySelector('.hyoumoji-search-input')?.focus(), 50);
  }

  function closePicker() {
    if (!pickerModal) return;
    pickerModal.style.display = 'none';
    currentSearchQuery = '';
    const input = pickerModal.querySelector('.hyoumoji-search-input');
    const clearBtn = pickerModal.querySelector('.hyoumoji-search-clear-btn');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    datasetCache.ascii = null;
  }

  // --- Shared Render Helpers ---
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

  function renderEmptyState(container, titleText, descText) {
    const box = document.createElement('div');
    box.className = 'hyoumoji-status-box';
    const title = document.createElement('strong');
    title.textContent = titleText;
    const desc = document.createElement('p');
    desc.textContent = descText;
    box.append(title, desc);
    container.appendChild(box);
  }

  function renderLoadMore(container, remaining, step) {
    if (remaining <= 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'hyoumoji-pagination-loader';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hyoumoji-load-more-btn';
    btn.textContent = `Load more (${remaining.toLocaleString()} left)`;
    btn.addEventListener('click', () => {
      renderLimit += step;
      renderTabContent();
    });
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }

  function createEmojiButton(emojiObj) {
    const emojiChar = typeof emojiObj === 'string' ? emojiObj : emojiObj.e;
    const keywords = typeof emojiObj === 'string' ? '' : (emojiObj.k || '');

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'hyoumoji-emoji-item';
    item.textContent = emojiChar;
    item.title = keywords ? keywords.split(' ').slice(0, 4).join(' ') : emojiChar;
    item.setAttribute('aria-label', item.title);
    item.addEventListener('click', () => {
      insertTextIntoTarget(emojiChar);
      addRecent('emojis', emojiChar);
    });
    return item;
  }

  function computeFittedFontSize(item) {
    if (!item.m) return '13px';
    const lines = (item.t || '').split('\n');
    const maxW = item.w || 20;
    const rows = lines.length || 1;
    // Scale to fit ~195px card width and ~84px preview height so full art is visible
    const byWidth = Math.floor(185 / Math.max(maxW * 0.62, 8));
    const byHeight = Math.floor(82 / Math.max(rows * 1.12, 4));
    const px = Math.max(4.5, Math.min(10, byWidth, byHeight));
    return `${px}px`;
  }

  function createAsciiCard(item) {
    const rawText = typeof item === 'string' ? item : item.t;
    const isMulti = Boolean(item.m);
    const isBraille = Boolean(item.b);

    const card = document.createElement('div');
    card.className = `hyoumoji-ascii-card ${isMulti ? 'is-multiline' : 'is-singleline'}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', item.k ? item.k.split(' ').slice(0, 4).join(' ') : 'ASCII item');

    const preview = document.createElement('pre');
    preview.className = `hyoumoji-ascii-preview ${isBraille ? 'is-braille' : ''}`;
    preview.style.fontSize = computeFittedFontSize(item);
    preview.textContent = rawText;

    const fav = isFavorited('ascii', rawText);
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `hyoumoji-fav-star ${fav ? 'is-fav' : ''}`;
    starBtn.title = fav ? 'Remove favorite' : 'Add to Favs';
    starBtn.setAttribute('aria-label', starBtn.title);
    starBtn.setAttribute('aria-pressed', String(fav));
    starBtn.textContent = fav ? '★' : '☆';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = toggleFavorite('ascii', item);
      starBtn.classList.toggle('is-fav', added);
      starBtn.setAttribute('aria-pressed', String(added));
      starBtn.textContent = added ? '★' : '☆';
      if (activeTab === 'favorites') renderTabContent();
    });

    const activateCard = () => {
      insertTextIntoTarget(prepareTextForInsert(item, activeContext));
      addRecent('ascii', item);
      closePicker();
    };

    card.append(preview, starBtn);
    card.addEventListener('click', activateCard);
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target !== card) return;
      e.preventDefault();
      activateCard();
    });

    return card;
  }

  // --- Tabs ---
  async function renderTabContent() {
    if (!pickerModal) return;
    const renderId = ++activeRenderId;
    try {
      const container = pickerModal.querySelector('#hyoumoji-tab-content');
      const subbar = pickerModal.querySelector('#hyoumoji-subbar-container');
      const searchInput = pickerModal.querySelector('.hyoumoji-search-input');
      if (!container) return;

      if (subbar) subbar.innerHTML = '';
      container.innerHTML = '';

      if (searchInput) {
        const placeholders = {
          recent: 'Search recent',
          favorites: 'Search favs',
          emojis: 'Search emoji',
          ascii: 'Search ascii'
        };
        searchInput.placeholder = placeholders[activeTab] || 'Search';
      }

      if (activeTab === 'recent') renderRecentTab(container);
      else if (activeTab === 'favorites') renderFavoritesTab(container);
      else if (activeTab === 'emojis') await renderEmojisTab(container, subbar, renderId);
      else if (activeTab === 'ascii') await renderAsciiTab(container, subbar, renderId);
    } catch (err) {
      console.warn('[hyoumoji] Tab render notice:', err);
    }
  }

  function renderRecentTab(container) {
    const q = currentSearchQuery;
    const emojis = (userStorage.recents.emojis || []).filter(e => !q || e.includes(q));
    const ascii = (userStorage.recents.ascii || []).filter(a => fitsContext(a, activeContext) && (!q || (a.k || '').includes(q) || (a.t || '').includes(q)));

    if (!emojis.length && !ascii.length) {
      renderEmptyState(container, 'No recents yet', 'Emojis and ASCII items you use appear here.');
      return;
    }

    if (emojis.length) {
      const grid = document.createElement('div');
      grid.className = 'hyoumoji-emoji-grid';
      emojis.forEach(e => grid.appendChild(createEmojiButton(e)));
      container.appendChild(grid);
    }

    if (ascii.length) {
      const grid = document.createElement('div');
      grid.className = 'hyoumoji-ascii-grid';
      ascii.forEach(a => grid.appendChild(createAsciiCard(a)));
      container.appendChild(grid);
    }
  }

  function renderFavoritesTab(container) {
    const q = currentSearchQuery;
    const ascii = (userStorage.favorites.ascii || []).filter(a => !q || (a.k || '').includes(q) || (a.t || '').includes(q));

    if (!ascii.length) {
      renderEmptyState(container, 'No favorites yet', 'Click ☆ on any ASCII face or art to save it here.');
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-ascii-grid';
    ascii.forEach(a => grid.appendChild(createAsciiCard(a)));
    container.appendChild(grid);
  }

  // --- WhatsApp-Style Emoji Panel ---
  function renderWhatsAppEmojiBar(subbar) {
    if (!subbar) return;
    const bar = document.createElement('div');
    bar.className = 'hyoumoji-wa-icon-bar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Emoji categories');

    WHATSAPP_EMOJI_TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hyoumoji-wa-icon-btn ${activeEmojiGroup === tab.id ? 'active' : ''}`;
      btn.title = tab.label;
      btn.setAttribute('aria-label', tab.label);
      btn.setAttribute('aria-selected', String(activeEmojiGroup === tab.id));
      btn.innerHTML = tab.svg;
      btn.addEventListener('click', () => {
        activeEmojiGroup = tab.id;
        renderLimit = DEFAULT_PAGE_LIMITS.emojis;
        renderTabContent();
      });
      bar.appendChild(btn);
    });
    subbar.appendChild(bar);
  }

  async function renderEmojisTab(container, subbar, renderId) {
    renderWhatsAppEmojiBar(subbar);
    if (!datasetCache.emojis) renderLoadingState(container, 'Loading emojis...');
    const allEmojis = await loadDataset('emojis');
    if (renderId !== activeRenderId) return;
    container.innerHTML = '';

    const q = currentSearchQuery;
    let filtered = [];

    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      filtered = allEmojis.filter(item => item.e === q || terms.every(t => item.k.includes(t)));
    } else if (activeEmojiGroup === 'recent') {
      const recents = userStorage.recents.emojis || [];
      filtered = recents.map(ch => allEmojis.find(e => e.e === ch) || { e: ch, k: '' });
      if (!filtered.length) {
        renderEmptyState(container, 'No recent emojis', 'Emojis you click will appear here.');
        return;
      }
    } else {
      filtered = allEmojis.filter(item => item.g === activeEmojiGroup);
    }

    if (!filtered.length) {
      renderEmptyState(container, 'No emoji found', `No match for "${q}".`);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-emoji-grid';
    const slice = filtered.slice(0, renderLimit);
    slice.forEach(item => grid.appendChild(createEmojiButton(item)));
    container.appendChild(grid);
    renderLoadMore(container, filtered.length - slice.length, PAGE_STEP.emojis);
  }

  // --- Unified ASCII Panel (2-Column Compact Grid + Multi-Select Filter Tags) ---
  function toggleAsciiTag(tagId) {
    if (tagId === 'all') {
      selectedAsciiTags = new Set(['all']);
      return;
    }
    selectedAsciiTags.delete('all');
    if (selectedAsciiTags.has(tagId)) {
      selectedAsciiTags.delete(tagId);
      if (selectedAsciiTags.size === 0) selectedAsciiTags.add('all');
    } else {
      selectedAsciiTags.add(tagId);
    }
  }

  function renderAsciiTagBar(subbar) {
    if (!subbar) return;
    const row = document.createElement('div');
    row.className = 'hyoumoji-tag-row';

    ASCII_FILTER_TAGS.forEach(tag => {
      const active = selectedAsciiTags.has(tag.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hyoumoji-tag-btn ${active ? 'active' : ''}`;
      btn.setAttribute('aria-pressed', String(active));
      btn.textContent = tag.label;
      btn.addEventListener('click', () => {
        toggleAsciiTag(tag.id);
        renderLimit = DEFAULT_PAGE_LIMITS.ascii;
        renderTabContent();
      });
      row.appendChild(btn);
    });
    subbar.appendChild(row);
  }

  async function renderAsciiTab(container, subbar, renderId) {
    renderAsciiTagBar(subbar);
    if (!datasetCache.ascii) renderLoadingState(container, 'Loading ASCII library...');
    const allAscii = await loadDataset('ascii');
    if (renderId !== activeRenderId) return;
    container.innerHTML = '';

    const q = currentSearchQuery;
    let filtered = allAscii.filter(item => fitsContext(item, activeContext) && matchesAsciiTags(item, selectedAsciiTags));

    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      const scored = [];
      for (const item of filtered) {
        const s = scoreAsciiMatch(item, terms);
        if (s > 0) scored.push({ item, s });
      }
      scored.sort((a, b) => b.s - a.s);
      filtered = scored.map(x => x.item);
    }

    const banner = document.createElement('div');
    banner.className = 'hyoumoji-results-count-banner';
    banner.textContent = `${filtered.length.toLocaleString()} results`;
    container.appendChild(banner);

    if (!filtered.length) {
      renderEmptyState(container, 'No results found', 'Try another keyword or toggle filter tags.');
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-ascii-grid';
    const slice = filtered.slice(0, renderLimit);
    slice.forEach(item => grid.appendChild(createAsciiCard(item)));
    container.appendChild(grid);
    renderLoadMore(container, filtered.length - slice.length, PAGE_STEP.ascii);
  }

  // --- Trigger Injection Across Platforms ---
  function createTriggerButton(editable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hyoumoji-trigger-btn';
    btn.title = 'Open hyoumoji';
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
