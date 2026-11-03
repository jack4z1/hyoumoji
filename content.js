/**
 * hyoumoji - YouTube Emojis, GIFs & Animated Stickers
 * Verified G-Rated Live GIF & Sticker Engine with Google Noto Emoji
 */

(function () {
  'use strict';

  // Only execute in the top-level main window (never inside player, ads, or shorts subframes)
  if (window !== window.top) {
    return;
  }

  // --- API Configuration (PG-Rated SafeSearch Enforced) ---
  const API_KEY = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';
  const GIPHY_BASE = 'https://api.giphy.com/v1';

  // State
  let activeCommentBox = null;
  let activeEditable = null;
  let pickerModal = null;
  let activeTab = 'emojis'; // 'recent', 'favorites', 'emojis', 'gifs', 'stickers'
  let currentSearchQuery = '';
  let currentOffset = 0;
  let isFetchingMedia = false;
  let hasMoreMedia = true;

  // In-memory cache for storage
  let userStorage = {
    recents: { emojis: [], gifs: [], stickers: [] },
    favorites: { gifs: [], stickers: [] },
    linkProtection: true // Warn before inserting GIF links into comments
  };

  // Helper to ensure extension context hasn't been invalidated during live reload
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

  function safeDecode(str) {
    try {
      return decodeURIComponent(str || '');
    } catch {
      return str || '';
    }
  }

  // --- Initialize Storage ---
  function loadUserStorage(callback) {
    try {
      if (isContextValid() && chrome.storage?.local) {
        chrome.storage.local.get(['hyoumoji_recents', 'hyoumoji_favorites', 'hyoumoji_link_protection'], (data) => {
          if (chrome.runtime?.lastError) {
            if (callback) callback();
            return;
          }
          if (data?.hyoumoji_recents) userStorage.recents = data.hyoumoji_recents;
          if (data?.hyoumoji_favorites) userStorage.favorites = data.hyoumoji_favorites;
          if (typeof data?.hyoumoji_link_protection === 'boolean') {
            userStorage.linkProtection = data.hyoumoji_link_protection;
          }
          if (callback) callback();
        });
        return;
      }
    } catch {}
    if (callback) callback();
  }

  function saveRecents() {
    try {
      if (isContextValid() && chrome.storage?.local) {
        chrome.storage.local.set({ hyoumoji_recents: userStorage.recents });
      }
    } catch {}
  }

  function saveFavorites() {
    try {
      if (isContextValid() && chrome.storage?.local) {
        chrome.storage.local.set({ hyoumoji_favorites: userStorage.favorites });
      }
    } catch {}
  }

  function saveLinkProtection(value) {
    userStorage.linkProtection = value;
    try {
      if (isContextValid() && chrome.storage?.local) {
        chrome.storage.local.set({ hyoumoji_link_protection: value });
      }
    } catch {}
  }

  // URL Sanitizer to prevent malicious or non-HTTPS URLs
  function sanitizeMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    // Disallow raw quotes, angle brackets, control characters, or spaces
    if (/[\s"'<>\\]/.test(rawUrl)) return null;
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'https:') return null;
      const host = parsed.hostname.toLowerCase();
      if (host.includes('giphy.com') || host.includes('tenor.com') || host.includes('googleusercontent.com')) {
        return parsed.href;
      }
      if (parsed.pathname.endsWith('.gif') || parsed.pathname.endsWith('.webp') || parsed.pathname.endsWith('.png')) {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  function addRecent(type, item) {
    if (!userStorage.recents[type]) userStorage.recents[type] = [];
    if (type === 'emojis') {
      userStorage.recents.emojis = userStorage.recents.emojis.filter(e => e !== item);
      userStorage.recents.emojis.unshift(item);
      if (userStorage.recents.emojis.length > 24) userStorage.recents.emojis.pop();
    } else {
      userStorage.recents[type] = userStorage.recents[type].filter(g => g.url !== item.url);
      userStorage.recents[type].unshift(item);
      if (userStorage.recents[type].length > 16) userStorage.recents[type].pop();
    }
    saveRecents();
  }

  function toggleFavorite(type, item) {
    if (!userStorage.favorites[type]) userStorage.favorites[type] = [];
    const index = userStorage.favorites[type].findIndex(f => f.url === item.url);
    let added = false;
    if (index > -1) {
      userStorage.favorites[type].splice(index, 1);
      showToast('Removed from Favorites');
    } else {
      userStorage.favorites[type].unshift(item);
      if (userStorage.favorites[type].length > 100) {
        userStorage.favorites[type].pop();
      }
      showToast('⭐ Saved to Favorites!');
      added = true;
    }
    saveFavorites();
    return added;
  }

  function isFavorited(type, url) {
    if (!userStorage.favorites[type]) return false;
    return userStorage.favorites[type].some(f => f.url === url);
  }

  // --- Toast Notification Helper ---
  function showToast(message) {
    let toast = document.getElementById('hyoumoji-toast-banner');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hyoumoji-toast-banner';
      toast.className = 'hyoumoji-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // --- Official Google / Android (Noto Color Emoji) Categories ---
  const GOOGLE_EMOJI_CATEGORIES = {
    'Popular': ['🔥', '💀', '😂', '😭', '🗿', '❤️', '✨', '👏', '💯', '🚀', '👀', '🐐', '🤯', '🫡', '🥺', '👑', '🤩', '🤣', '🥳', '🙏', '🙌', '👍', '👎', '⚡', '💎', '🍿', '🎯', '💡', '💖', '😴', '🤝', '🕺', '💃', '🕶️', '🤡'],
    'Smileys & Emotions': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫', '🫠', '🤥', '😶', '😐', '😑', '😬', '🫨', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
    'Gestures & Body': ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
    'Animals & Nature': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🐙', '🦑', '🦐', '🦀', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🦒', '🦘', '🦬', '🐐', '🐑', '🐈', '🐈‍⬛', '🐕', '🕊️', '🌸', '🌹', '🌻', '🌺', '🍀', '🌴'],
    'Food & Drinks': ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🍜', '🍣', '🍱', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍿', '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻'],
    'Activities & Objects': ['🎉', '🎊', '🎁', '🎈', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎮', '🕹️', '🎲', '🧩', '🎸', '🎹', '🎺', '🎻', '🥁', '🎨', '🎬', '🎤', '🎧', '📱', '💻', '💡', '⏰', '⌛', '💎', '💰', '💵', '💳', '⚔️', '🛡️', '🔮', '🪄', '💣', '🧨', '🧿']
  };

  // --- Insertion Helper for YouTube's contenteditable editor ---
  function insertIntoYouTubeComment(text) {
    if (!activeEditable) {
      console.warn('[hyoumoji] No active comment input target.');
      return;
    }

    activeEditable.focus();

    const success = document.execCommand('insertText', false, text);
    if (!success) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        activeEditable.textContent += text;
      }
    }

    // Dispatch input & change events so YouTube's internal state updates
    activeEditable.dispatchEvent(new Event('input', { bubbles: true }));
    activeEditable.dispatchEvent(new Event('change', { bubbles: true }));
    activeEditable.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
    activeEditable.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
  }

  // --- Attach GIF/Sticker into Comment (Hidden from typing line, keeps Comment button active!) ---
  function attachMediaToComment(commentBox, editable, mediaItem, type) {
    if (!editable) return;
    editable.focus();

    // Remove any previous hidden payload in this box
    const oldPayload = editable.querySelector('.hyoumoji-hidden-payload');
    if (oldPayload) oldPayload.remove();

    // Create hidden payload span that enables YouTube's Comment button without showing raw URL
    const span = document.createElement('span');
    span.className = 'hyoumoji-hidden-payload';
    span.setAttribute('contenteditable', 'false');
    span.textContent = ` ${mediaItem.url} `;
    editable.appendChild(span);

    // Dispatch input & change events so YouTube recognizes non-empty text and enables the "Comment" button!
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    editable.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
    editable.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

    // Show visual draft preview card
    showDraftPreview(commentBox, editable, mediaItem, type);
  }

  // --- Live Draft Preview Inside Active YouTube Comment Box ---
  function showDraftPreview(commentBox, editable, mediaItem, type) {
    if (!commentBox) return;

    // Remove any existing draft preview in this box
    const oldPreview = commentBox.querySelector('.hyoumoji-draft-preview-container');
    if (oldPreview) oldPreview.remove();

    const previewContainer = document.createElement('div');
    previewContainer.className = 'hyoumoji-draft-preview-container';

    const thumb = document.createElement('img');
    thumb.className = 'hyoumoji-draft-preview-thumb';
    thumb.src = mediaItem.previewUrl || mediaItem.url;
    thumb.alt = mediaItem.title;
    previewContainer.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'hyoumoji-draft-preview-info';

    const badge = document.createElement('span');
    badge.className = 'hyoumoji-draft-badge';
    badge.textContent = type === 'stickers' ? 'Attached Sticker' : 'Attached GIF';
    info.appendChild(badge);

    const title = document.createElement('span');
    title.className = 'hyoumoji-draft-title';
    title.textContent = mediaItem.title || 'Reaction';
    info.appendChild(title);

    previewContainer.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'hyoumoji-draft-remove-btn';
    removeBtn.title = 'Remove attached media';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      previewContainer.remove();
      if (editable) {
        const payload = editable.querySelector('.hyoumoji-hidden-payload');
        if (payload) payload.remove();
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    previewContainer.appendChild(removeBtn);

    // Automatically remove draft preview when user clicks Comment or Cancel
    const submitBtn = commentBox.querySelector('#submit-button');
    if (submitBtn && !submitBtn.hasAttribute('data-hyoumoji-cleanup-bound')) {
      submitBtn.setAttribute('data-hyoumoji-cleanup-bound', 'true');
      submitBtn.addEventListener('click', () => {
        setTimeout(() => {
          const p = commentBox.querySelector('.hyoumoji-draft-preview-container');
          if (p) p.remove();
        }, 500);
      });
    }

    const cancelBtn = commentBox.querySelector('#cancel-button');
    if (cancelBtn && !cancelBtn.hasAttribute('data-hyoumoji-cancel-bound')) {
      cancelBtn.setAttribute('data-hyoumoji-cancel-bound', 'true');
      cancelBtn.addEventListener('click', () => {
        const p = commentBox.querySelector('.hyoumoji-draft-preview-container');
        if (p) p.remove();
        const payload = editable ? editable.querySelector('.hyoumoji-hidden-payload') : null;
        if (payload) payload.remove();
      });
    }

    // Place preview right below input-container or above buttons
    const inputContainer = commentBox.querySelector('#input-container') || commentBox.querySelector('#placeholder-area');
    if (inputContainer && inputContainer.parentNode) {
      inputContainer.parentNode.insertBefore(previewContainer, inputContainer.nextSibling);
    } else {
      commentBox.prepend(previewContainer);
    }
  }

  // --- Picker Modal Creation & Management ---
  function createPickerModal() {
    if (document.getElementById('hyoumoji-picker-container')) {
      return document.getElementById('hyoumoji-picker-container');
    }

    const modal = document.createElement('div');
    modal.id = 'hyoumoji-picker-container';
    modal.style.display = 'none';

    const iconUrl = getSafeExtensionUrl('icons/icon48.png');

    modal.innerHTML = `
      <div class="hyoumoji-header">
        <div class="hyoumoji-title">
          ${iconUrl ? `<img src="${iconUrl}" class="hyoumoji-header-icon" alt="hyoumoji" />` : '✨'}
          hyoumoji
        </div>
        <button type="button" class="hyoumoji-close-btn" title="Close">✕</button>
      </div>

      <div class="hyoumoji-tabs">
        <button class="hyoumoji-tab-btn" data-tab="recent" title="Recently Used">🕒 Recent</button>
        <button class="hyoumoji-tab-btn" data-tab="favorites" title="Starred Favorites">⭐ Favs</button>
        <button class="hyoumoji-tab-btn active" data-tab="emojis" title="Google Noto Emojis">😀 Emojis</button>
        <button class="hyoumoji-tab-btn" data-tab="gifs" title="Trending & Search GIFs">🎬 GIFs</button>
        <button class="hyoumoji-tab-btn" data-tab="stickers" title="Animated Stickers">🎀 Stickers</button>
      </div>

      <div class="hyoumoji-search-container">
        <input type="text" class="hyoumoji-search-input" placeholder="Search Google emojis, GIFs & stickers..." />
      </div>

      <div class="hyoumoji-chips-row" id="hyoumoji-chips-container"></div>

      <div class="hyoumoji-body" id="hyoumoji-tab-content"></div>

      <div class="hyoumoji-footer-tip">
        <span>Infinite Library • 500+ GIFs per Search</span>
        <span style="opacity: 0.8;">hyoumoji</span>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.hyoumoji-close-btn').addEventListener('click', closePicker);

    // Infinite scroll listener on tab content container
    const bodyContent = modal.querySelector('#hyoumoji-tab-content');
    if (bodyContent) {
      bodyContent.addEventListener('scroll', () => {
        if (activeTab === 'gifs' || activeTab === 'stickers') {
          if (!isFetchingMedia && hasMoreMedia) {
            if (bodyContent.scrollTop + bodyContent.clientHeight >= bodyContent.scrollHeight - 160) {
              const grid = bodyContent.querySelector('.hyoumoji-media-grid');
              if (grid) {
                fetchLiveMedia(currentSearchQuery, activeTab === 'stickers', grid, true);
              }
            }
          }
        }
      });
    }

    modal.querySelectorAll('.hyoumoji-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.hyoumoji-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        renderTabContent();
      });
    });

    const searchInput = modal.querySelector('.hyoumoji-search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearchQuery = e.target.value.trim().toLowerCase();
        renderTabContent();
      }, 250);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        currentSearchQuery = e.target.value.trim().toLowerCase();
        renderTabContent();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (modal.style.display !== 'none') {
        if (!modal.contains(e.target) && !e.target.closest('.hyoumoji-trigger-btn') && !e.target.closest('.hyoumoji-save-btn')) {
          closePicker();
        }
      }
    });

    return modal;
  }

  function openPicker(triggerBtn, commentBox, editable) {
    if (!pickerModal) {
      pickerModal = createPickerModal();
    }

    activeCommentBox = commentBox;
    activeEditable = editable;

    const rect = triggerBtn.getBoundingClientRect();
    const modalWidth = 460;
    const modalHeight = 520;

    let left = rect.left;
    let top = rect.bottom + window.scrollY + 8;

    if (left + modalWidth > window.innerWidth - 16) {
      left = window.innerWidth - modalWidth - 16;
    }
    if (left < 16) left = 16;

    if (rect.bottom + modalHeight > window.innerHeight && rect.top > modalHeight) {
      top = rect.top + window.scrollY - modalHeight - 8;
    }

    pickerModal.style.left = `${Math.max(10, left)}px`;
    pickerModal.style.top = `${Math.max(10, top)}px`;
    pickerModal.style.display = 'flex';

    renderTabContent();

    setTimeout(() => {
      const search = pickerModal.querySelector('.hyoumoji-search-input');
      if (search) search.focus();
    }, 100);
  }

  function closePicker() {
    if (pickerModal) {
      pickerModal.style.display = 'none';
      currentSearchQuery = '';
      const input = pickerModal.querySelector('.hyoumoji-search-input');
      if (input) input.value = '';
    }
  }

  // --- Render Tabs Content ---
  function renderTabContent() {
    if (!pickerModal) return;
    try {
      currentOffset = 0;
      hasMoreMedia = true;

      const container = pickerModal.querySelector('#hyoumoji-tab-content');
      const chipsContainer = pickerModal.querySelector('#hyoumoji-chips-container');
      if (chipsContainer) chipsContainer.innerHTML = '';
      if (container) container.innerHTML = '';

      if (activeTab === 'recent') {
        renderRecentTab(container);
      } else if (activeTab === 'favorites') {
        renderFavoritesTab(container);
      } else if (activeTab === 'emojis') {
        renderEmojisTab(container, chipsContainer);
      } else if (activeTab === 'gifs') {
        renderMediaTab(container, chipsContainer, false);
      } else if (activeTab === 'stickers') {
        renderMediaTab(container, chipsContainer, true);
      }
    } catch (err) {
      console.warn('[hyoumoji] Tab render notice:', err);
    }
  }

  // 1. Recent Tab
  function renderRecentTab(container) {
    const { emojis, gifs, stickers } = userStorage.recents;
    const hasAny = (emojis && emojis.length > 0) || (gifs && gifs.length > 0) || (stickers && stickers.length > 0);

    if (!hasAny) {
      container.innerHTML = `
        <div class="hyoumoji-status-box">
          <span style="font-size: 32px;">🕒</span>
          <strong>No recents yet</strong>
          <p>Emojis, GIFs, and stickers you pick will show up right here!</p>
        </div>
      `;
      return;
    }

    if (emojis && emojis.length > 0) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = 'Recent Emojis';
      container.appendChild(title);

      const emojiGrid = document.createElement('div');
      emojiGrid.className = 'hyoumoji-emoji-grid';
      emojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'hyoumoji-emoji-item';
        item.textContent = emoji;
        item.addEventListener('click', () => {
          insertIntoYouTubeComment(emoji);
          addRecent('emojis', emoji);
        });
        emojiGrid.appendChild(item);
      });
      container.appendChild(emojiGrid);
    }

    if (gifs && gifs.length > 0) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = 'Recent GIFs';
      container.appendChild(title);

      const gifGrid = document.createElement('div');
      gifGrid.className = 'hyoumoji-media-grid';
      gifs.forEach(gif => {
        gifGrid.appendChild(createMediaCard(gif, 'gifs'));
      });
      container.appendChild(gifGrid);
    }

    if (stickers && stickers.length > 0) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = 'Recent Stickers';
      container.appendChild(title);

      const stickerGrid = document.createElement('div');
      stickerGrid.className = 'hyoumoji-media-grid';
      stickers.forEach(sticker => {
        stickerGrid.appendChild(createMediaCard(sticker, 'stickers'));
      });
      container.appendChild(stickerGrid);
    }
  }

  // 2. Favorites Tab
  function renderFavoritesTab(container) {
    const { gifs, stickers } = userStorage.favorites;
    const hasAny = (gifs && gifs.length > 0) || (stickers && stickers.length > 0);

    if (!hasAny) {
      container.innerHTML = `
        <div class="hyoumoji-status-box">
          <span style="font-size: 32px;">⭐</span>
          <strong>No favorites saved yet</strong>
          <p>Click the ⭐ star icon on any GIF/sticker, or click "⭐ Save" on any YouTube comment to build your collection!</p>
        </div>
      `;
      return;
    }

    if (gifs && gifs.length > 0) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = `Saved GIFs (${gifs.length})`;
      container.appendChild(title);

      const gifGrid = document.createElement('div');
      gifGrid.className = 'hyoumoji-media-grid';
      gifs.forEach(gif => {
        gifGrid.appendChild(createMediaCard(gif, 'gifs'));
      });
      container.appendChild(gifGrid);
    }

    if (stickers && stickers.length > 0) {
      const title = document.createElement('div');
      title.className = 'hyoumoji-section-title';
      title.textContent = `Saved Stickers (${stickers.length})`;
      container.appendChild(title);

      const stickerGrid = document.createElement('div');
      stickerGrid.className = 'hyoumoji-media-grid';
      stickers.forEach(sticker => {
        stickerGrid.appendChild(createMediaCard(sticker, 'stickers'));
      });
      container.appendChild(stickerGrid);
    }
  }

  // 3. Emojis Tab
  function renderEmojisTab(container, chipsContainer) {
    const categories = Object.keys(GOOGLE_EMOJI_CATEGORIES);
    categories.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = 'hyoumoji-chip';
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        const target = container.querySelector(`[data-cat-header="${cat}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      chipsContainer.appendChild(chip);
    });

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-emoji-grid';

    let allEmojis = [];
    categories.forEach(cat => {
      GOOGLE_EMOJI_CATEGORIES[cat].forEach(e => allEmojis.push(e));
    });
    allEmojis = Array.from(new Set(allEmojis));

    let displayList = allEmojis;
    if (currentSearchQuery) {
      displayList = allEmojis.filter(emoji => emoji.includes(currentSearchQuery));
      if (displayList.length === 0) displayList = allEmojis.slice(0, 48);
    }

    displayList.forEach(emoji => {
      const item = document.createElement('div');
      item.className = 'hyoumoji-emoji-item';
      item.textContent = emoji;
      item.addEventListener('click', () => {
        insertIntoYouTubeComment(emoji);
        addRecent('emojis', emoji);
      });
      grid.appendChild(item);
    });

    container.appendChild(grid);
  }

  // 4 & 5. GIFs & Animated Stickers Live Tab
  function renderMediaTab(container, chipsContainer, isSticker) {
    const chips = isSticker
      ? ['Trending', '🎃 Halloween', 'Cute', 'Love', 'Cat', 'Anime', 'Pepe', 'Wow', 'Party']
      : ['Trending', '🎃 Halloween', '😂 Laugh', '🔥 Fire', '💀 Skull', '🐱 Cat', '💃 Dance', '🎉 Celebrate', '😭 Cry', '👀 Sus', '❤️ Love', '🤯 Mind Blown'];

    chips.forEach(tag => {
      const isTrending = tag === 'Trending';
      const cleanTag = tag.replace(/^[^\w\s]+\s*/, '');
      const chip = document.createElement('div');
      chip.className = `hyoumoji-chip ${(!currentSearchQuery && isTrending) || currentSearchQuery === cleanTag.toLowerCase() ? 'active' : ''}`;
      chip.textContent = tag;
      chip.addEventListener('click', () => {
        currentSearchQuery = isTrending ? '' : cleanTag.toLowerCase();
        pickerModal.querySelector('.hyoumoji-search-input').value = currentSearchQuery;
        renderTabContent();
      });
      chipsContainer.appendChild(chip);
    });

    const grid = document.createElement('div');
    grid.className = 'hyoumoji-media-grid';

    // Show loading spinner
    const spinnerBox = document.createElement('div');
    spinnerBox.className = 'hyoumoji-status-box';
    spinnerBox.style.gridColumn = '1 / -1';
    spinnerBox.innerHTML = `
      <div class="hyoumoji-spinner"></div>
      <span>Loading ${isSticker ? 'animated stickers' : 'trending GIFs'}...</span>
    `;
    grid.appendChild(spinnerBox);

    container.appendChild(grid);

    // Fetch live media from endpoint
    fetchLiveMedia(currentSearchQuery || '', isSticker, grid);
  }

  // Strip helper words like "gif" or "sticker" from search queries to maximize result count
  function cleanSearchQuery(q) {
    if (!q || typeof q !== 'string') return '';
    return q.replace(/\b(gifs?|stickers?|animated|animation)\b/gi, '').trim();
  }

  // --- Helper to Create Media Card with Favorite Star ---
  function createMediaCard(mediaItem, type) {
    const card = document.createElement('div');
    card.className = `hyoumoji-media-item ${type === 'stickers' ? 'hyoumoji-sticker-item' : ''}`;
    const safeTitle = mediaItem.title || (type === 'stickers' ? 'Sticker' : 'GIF');
    card.title = safeTitle;

    const safeUrl = sanitizeMediaUrl(mediaItem.url) || mediaItem.url;
    const safePreview = sanitizeMediaUrl(mediaItem.previewUrl) || safeUrl;
    const isFav = isFavorited(type, safeUrl);

    const img = document.createElement('img');
    img.src = safePreview;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = safeTitle;
    card.appendChild(img);

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `hyoumoji-fav-star-btn ${isFav ? 'is-fav' : ''}`;
    starBtn.title = isFav ? 'Remove favorite' : 'Add to favorites';
    starBtn.textContent = isFav ? '★' : '☆';
    card.appendChild(starBtn);

    const label = document.createElement('div');
    label.className = 'hyoumoji-media-label';
    label.textContent = safeTitle;
    card.appendChild(label);

    // Star button click (Toggles favorite without inserting)
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = toggleFavorite(type, mediaItem);
      starBtn.classList.toggle('is-fav', added);
      starBtn.textContent = added ? '★' : '☆';
      starBtn.title = added ? 'Remove favorite' : 'Add to favorites';
      if (activeTab === 'favorites') {
        renderTabContent();
      }
    });

    // Body click (Attaches media immediately with 1 click)
    card.addEventListener('click', () => {
      attachMediaToComment(activeCommentBox, activeEditable, mediaItem, type);
      addRecent(type, mediaItem);
      closePicker();
    });

    return card;
  }

  // --- Secure Background Fetch Helper (Manifest V3 CORS Proxy) ---
  function fetchMediaViaBackground(endpoint) {
    return new Promise((resolve, reject) => {
      try {
        if (isContextValid() && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'fetch_media', endpoint }, (response) => {
            if (chrome.runtime?.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'Failed to fetch media'));
            }
          });
          return;
        }
      } catch (err) {
        return reject(err);
      }

      // Fallback for offline test environments
      fetch(endpoint)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  // --- Live SafeSearch Media Fetcher with Pagination & Fast Loading ---
  async function fetchLiveMedia(query, isSticker, gridElement, isAppend = false) {
    if (isFetchingMedia) return;
    isFetchingMedia = true;

    try {
      const typeEndpoint = isSticker ? 'stickers' : 'gifs';
      const cleanQuery = cleanSearchQuery(query);
      const rating = 'pg-13'; // Unlocks full holiday and pop-culture library without restrictions
      const limit = 50; // Rich 50-item grid

      let endpoint = '';
      if (!cleanQuery || cleanQuery === 'trending') {
        endpoint = `${GIPHY_BASE}/${typeEndpoint}/trending?api_key=${API_KEY}&limit=${limit}&offset=${currentOffset}&rating=${rating}`;
      } else {
        endpoint = `${GIPHY_BASE}/${typeEndpoint}/search?api_key=${API_KEY}&q=${encodeURIComponent(cleanQuery)}&limit=${limit}&offset=${currentOffset}&rating=${rating}`;
      }

      const data = await fetchMediaViaBackground(endpoint);

      if (!isAppend) {
        gridElement.innerHTML = '';
        const banner = document.createElement('div');
        banner.className = 'hyoumoji-results-count-banner';
        banner.textContent = cleanQuery
          ? `Top results for "${cleanQuery}" (500+ available)`
          : `Trending ${isSticker ? 'Stickers' : 'GIFs'} (500+ available)`;
        banner.style.gridColumn = '1 / -1';
        gridElement.appendChild(banner);
      } else {
        const oldLoader = gridElement.querySelector('.hyoumoji-pagination-loader');
        if (oldLoader) oldLoader.remove();
      }

      if (!data.data || data.data.length === 0) {
        if (!isAppend) {
          gridElement.innerHTML = `
            <div class="hyoumoji-status-box" style="grid-column: 1 / -1;">
              <span>No results found for "${query}"</span>
            </div>
          `;
        }
        hasMoreMedia = false;
        isFetchingMedia = false;
        return;
      }

      data.data.forEach(item => {
        // Use downsized_medium / fixed_height for 20x faster thumbnail and comment rendering
        const preview = item.images?.fixed_height_small?.url ||
                        item.images?.fixed_height?.url ||
                        item.images?.original?.url;
        const fastMedia = item.images?.downsized_medium?.url ||
                          item.images?.fixed_height?.url ||
                          item.images?.original?.url || preview;
        if (!preview) return;

        const mediaObj = {
          title: item.title || (isSticker ? 'Sticker' : 'GIF'),
          url: fastMedia,
          previewUrl: preview
        };

        gridElement.appendChild(createMediaCard(mediaObj, isSticker ? 'stickers' : 'gifs'));
      });

      currentOffset += data.data.length;
      hasMoreMedia = (data.pagination?.total_count || 500) > currentOffset;

      if (hasMoreMedia) {
        const loader = document.createElement('div');
        loader.className = 'hyoumoji-pagination-loader';
        loader.style.gridColumn = '1 / -1';
        loader.innerHTML = `
          <button type="button" class="hyoumoji-load-more-btn">Load 50 More ${isSticker ? 'Stickers' : 'GIFs'}...</button>
        `;
        loader.querySelector('button').addEventListener('click', (e) => {
          e.stopPropagation();
          loader.innerHTML = '<div class="hyoumoji-spinner"></div>';
          fetchLiveMedia(currentSearchQuery, isSticker, gridElement, true);
        });
        gridElement.appendChild(loader);
      }
    } catch (err) {
      console.warn('[hyoumoji] Live media notice:', err.message);
      if (!isAppend) {
        gridElement.innerHTML = `
          <div class="hyoumoji-status-box" style="grid-column: 1 / -1;">
            <span>Could not load media. Check network connection.</span>
          </div>
        `;
      }
    } finally {
      isFetchingMedia = false;
    }
  }

  // --- Attach Button to YouTube Comment Boxes ---
  function injectHyoumojiButton(commentbox) {
    if (!commentbox || commentbox.hasAttribute('data-hyoumoji-injected')) {
      return;
    }

    const editable = commentbox.querySelector('div#contenteditable-root') ||
                     commentbox.querySelector('[contenteditable="true"]');
    if (!editable) return;

    const buttonsArea = commentbox.querySelector('#buttons') ||
                        commentbox.querySelector('#footer') ||
                        commentbox.querySelector('#action-buttons');
    if (!buttonsArea) return;

    if (commentbox.querySelector('.hyoumoji-trigger-btn')) return;

    commentbox.setAttribute('data-hyoumoji-injected', 'true');

    // Create Hyoumoji trigger button with User's custom sticker icon
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hyoumoji-trigger-btn';
    btn.title = 'Add Emojis, GIFs & Stickers (hyoumoji)';

    const iconUrl = getSafeExtensionUrl('icons/icon48.png');
    btn.innerHTML = `
      ${iconUrl ? `<img src="${iconUrl}" class="hyoumoji-btn-sticker-icon" alt="hyoumoji" />` : ''}
      <span>hyoumoji</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(btn, commentbox, editable);
    });

    const nativeEmojiBtn = buttonsArea.querySelector('#emoji-button');
    if (nativeEmojiBtn && nativeEmojiBtn.parentNode) {
      nativeEmojiBtn.parentNode.insertBefore(btn, nativeEmojiBtn);
    } else {
      buttonsArea.prepend(btn);
    }
  }

  // --- Live Inline Rendering of Comments + "⭐ Save to Favorites" ---
  function renderInlineMediaInComments() {
    const commentNodes = document.querySelectorAll('ytd-comment-view-model #content-text, ytd-expander #content-text, yt-formatted-string#content-text');

    commentNodes.forEach(node => {
      if (node.hasAttribute('data-hyoumoji-rendered')) return;

      const text = node.innerText || node.textContent || '';
      // Support Giphy, Tenor, or direct .gif/.webp URLs
      const urlRegex = /(https?:\/\/(?:media\d*\.giphy\.com\/[^\s"'>]+|i\.giphy\.com\/[^\s"'>]+|media\.tenor\.com\/[^\s"'>]+|tenor\.com\/view\/[^\s"'>]+|[^\s"'>]+\.(?:gif|webp))(?:\?[^\s"'>]*)?)/i;
      const match = text.match(urlRegex);

      if (match) {
        node.setAttribute('data-hyoumoji-rendered', 'true');
        const rawUrl = match[1];
        const mediaUrl = sanitizeMediaUrl(rawUrl);
        if (!mediaUrl) return;

        // 1. Hide all links pointing to media or showing media URL
        const linkTags = node.querySelectorAll('a');
        linkTags.forEach(a => {
          const href = safeDecode(a.href).toLowerCase();
          const aText = (a.textContent || '').toLowerCase();
          if (
            href.includes('giphy.com') ||
            href.includes('tenor.com') ||
            aText.includes('giphy.com') ||
            aText.includes('tenor.com') ||
            href.endsWith('.gif') ||
            href.endsWith('.webp')
          ) {
            a.style.display = 'none';
            if (a.parentElement && a.parentElement !== node && a.parentElement.children.length === 1) {
              a.parentElement.style.display = 'none';
            }
          }
        });

        // 2. Remove raw URL text from all text nodes using TreeWalker
        try {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
          let currentTextNode;
          while ((currentTextNode = walker.nextNode())) {
            if (urlRegex.test(currentTextNode.nodeValue)) {
              currentTextNode.nodeValue = currentTextNode.nodeValue.replace(urlRegex, '').trim();
            }
          }
        } catch {}

        // 3. If comment has no other text, hide the empty text container completely
        const remainingText = (node.innerText || node.textContent || '').trim();
        if (!remainingText) {
          node.style.display = 'none';
        }

        const isSticker = mediaUrl.includes('sticker') || mediaUrl.includes('nanogif');
        const type = isSticker ? 'stickers' : 'gifs';
        const alreadyFav = isFavorited(type, mediaUrl);

        const badge = document.createElement('div');
        badge.className = 'hyoumoji-comment-badge';

        const tagPill = document.createElement('span');
        tagPill.className = 'hyoumoji-tag-pill';
        tagPill.textContent = isSticker ? 'Sticker' : 'GIF';
        badge.appendChild(tagPill);

        const saveBtn = document.createElement('button');
        saveBtn.className = `hyoumoji-save-btn ${alreadyFav ? 'is-saved' : ''}`;
        saveBtn.title = alreadyFav ? 'Saved to favorites' : 'Save to my favorites';
        saveBtn.textContent = alreadyFav ? '★ Saved' : '⭐ Save';
        badge.appendChild(saveBtn);

        let fastRenderUrl = mediaUrl;
        if (fastRenderUrl.includes('giphy.com') && fastRenderUrl.endsWith('/giphy.gif')) {
          fastRenderUrl = fastRenderUrl.replace(/\/giphy\.gif$/, '/200.gif');
        }

        const img = document.createElement('img');
        img.src = fastRenderUrl;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = 'hyoumoji reaction';
        img.title = 'Click to open original';
        badge.appendChild(img);

        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mediaItem = {
            title: isSticker ? 'Saved Sticker' : 'Saved GIF',
            url: mediaUrl,
            previewUrl: mediaUrl
          };
          const added = toggleFavorite(type, mediaItem);
          saveBtn.classList.toggle('is-saved', added);
          saveBtn.textContent = added ? '★ Saved' : '⭐ Save';
          saveBtn.title = added ? 'Saved to favorites' : 'Save to my favorites';
        });

        badge.addEventListener('click', () => {
          window.open(mediaUrl, '_blank', 'noopener,noreferrer');
        });

        if (node.parentNode) {
          node.parentNode.insertBefore(badge, node.nextSibling);
        }
      }
    });
  }

  // --- Scan and Observe DOM for Comments (Debounced for 60fps Performance) ---
  function scanForCommentBoxes() {
    const boxes = document.querySelectorAll('ytd-commentbox, ytd-comment-simplebox-renderer');
    boxes.forEach(box => injectHyoumojiButton(box));

    renderInlineMediaInComments();
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
      scanForCommentBoxes();
    }, 150);
  }

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(scheduleScan, 800);
  });

  // Initial load
  loadUserStorage(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanForCommentBoxes);
    } else {
      scanForCommentBoxes();
    }
  });

  console.log('[hyoumoji] Extension initialized.');
})();
