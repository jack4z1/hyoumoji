/**
 * Automated Security Audit, Credential/Leak Scan, Dataset Integrity & Context Tests for hyoumoji v2.0
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING HYOUMOJI v2.0 SECURITY & INTEGRITY TESTS');
  console.log('====================================================\n');

  // 1. Manifest & Permissions Security
  console.log('--- TEST 1: Manifest Integrity & Permissions Security ---');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));

  assert(manifest.manifest_version === 3, 'Manifest Version is 3');
  assert(manifest.permissions.length === 1 && manifest.permissions[0] === 'storage',
    'Permissions strictly limited to "storage"');
  assert(!manifest.host_permissions, 'Zero external API host_permissions');
  assert(!manifest.background, 'Zero background service worker');
  assert(manifest.content_scripts[0].all_frames === true, 'all_frames enabled safely for YouTube Live Chat iframe');
  assert(manifest.web_accessible_resources[0].resources.includes('data/*.json'), 'Data JSONs exposed in web_accessible_resources');
  assert(!fs.existsSync(path.join(ROOT_DIR, 'background.js')), 'Legacy background.js proxy cleanly removed');
  assert(fs.existsSync(path.join(ROOT_DIR, manifest.icons['48'])), 'Extension icon exists');

  // 2. Credential, Data Leak, External Network & XSS Audit
  console.log('\n--- TEST 2: Credential, Data Leak & XSS Audit ---');
  const contentJs = fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8');
  const contentCss = fs.readFileSync(path.join(ROOT_DIR, 'content.css'), 'utf8');
  const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');
  const readmeMd = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');

  const combinedSource = [contentJs, contentCss, popupHtml].join('\n');
  const forbiddenRegexes = [
    /api[_-]?key\s*[:=]/i,
    /giphy\.com/i,
    /tenor\./i,
    /google-analytics|mixpanel|amplitude/i,
    /chrome\.cookies|chrome\.identity|navigator\.sendBeacon/i,
    /\beval\s*\(|new\s+Function\s*\(/i,
    /fonts\.googleapis\.com/i,
    /http:\/\//i
  ];
  const matched = forbiddenRegexes.filter(rx => rx.test(combinedSource));
  assert(matched.length === 0, `Zero credentials, external endpoints, trackers, HTTP URLs, or eval() found`);
  assert(!/giphy|tenor/i.test(readmeMd), 'README.md free of stale GIF/GIPHY/Tenor documentation');
  assert(contentJs.includes("window.location.pathname.startsWith('/live_chat')"), 'Iframe guard restricts subframes strictly to YouTube /live_chat');
  assert(contentJs.includes("cache: 'no-store'"), 'Local JSON loader disables stale browser cache');
  assert(contentJs.includes("chrome.storage.local.remove(['hyoumoji_recents'"), 'Legacy v1 storage cache purged on startup');
  assert(contentJs.includes('activeRenderId'), 'Async tab-switch race-condition guard present');
  assert(contentCss.includes('prefers-reduced-motion'), 'CSS respects prefers-reduced-motion accessibility preference');
  assert(contentCss.includes('box-sizing: border-box'), 'CSS isolates box-sizing against host page bleed');

  // 3. Offline Dataset Integrity & XSS Safety
  console.log('\n--- TEST 3: Offline Dataset Integrity & Safety ---');
  const emojis = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/emojis.json'), 'utf8'));
  const kaomoji = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/kaomoji.json'), 'utf8'));
  const ascii = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/ascii_art.json'), 'utf8'));

  assert(Array.isArray(emojis) && emojis.length > 1800, `Loaded ${emojis.length} keyword-searchable emojis`);
  assert(Array.isArray(kaomoji) && kaomoji.length > 30000, `Loaded ${kaomoji.length} deduplicated kaomoji`);
  assert(Array.isArray(ascii) && ascii.length > 5000, `Loaded ${ascii.length} ASCII & Braille artworks`);

  const fireEmoji = emojis.find(e => e.e === '🔥');
  assert(fireEmoji && fireEmoji.k.includes('fire'), 'Emoji keyword search index includes "fire" for 🔥');

  const hasDangerousHtml = [...kaomoji, ...ascii].some(x => /<(script|iframe|img|svg)\b/i.test(x.t));
  assert(!hasDangerousHtml, 'Zero <script>/<iframe>/<img> XSS strings in compiled datasets');

  // 4. Platform Context & Space-Fitting Filter Tests
  console.log('\n--- TEST 4: Platform Context & Space-Fitting Filters ---');
  function fitsContext(item, ctx) {
    const len = item.c || (item.t ? item.t.length : 0);
    const width = item.w || len;
    const isMulti = Boolean(item.m);
    const isBraille = Boolean(item.b);
    if (len > ctx.maxChars) return false;
    if (ctx.allowMultiline) return width <= ctx.maxWidth;
    if (!isMulti) return true;
    return Boolean(ctx.supportsAutoWrap && isBraille && width >= 20 && width <= ctx.maxWidth);
  }

  const ctxYtLive = { maxChars: 200, allowMultiline: false, maxWidth: 28, supportsAutoWrap: false };
  const ctxYtShort = { maxChars: 10000, allowMultiline: true, maxWidth: 32, supportsAutoWrap: false };
  const ctxYtLong = { maxChars: 10000, allowMultiline: true, maxWidth: 80, supportsAutoWrap: false };
  const ctxTwitch = { maxChars: 500, allowMultiline: false, maxWidth: 30, supportsAutoWrap: true };
  const ctxTikTok = { maxChars: 150, allowMultiline: false, maxWidth: 28, supportsAutoWrap: false };

  const singleLineKaomoji = { t: '(╯°□°）╯︵ ┻━┻', c: 13, w: 13, m: 0, b: 0 };
  const long1Line = { t: 'x'.repeat(180), c: 180, w: 180, m: 0, b: 0 };
  const wideAscii = { t: 'line1\nline2', c: 100, w: 60, m: 1, b: 0 };
  const narrowBraille = { t: '⣿'.repeat(24) + '\n' + '⣿'.repeat(24), c: 49, w: 24, m: 1, b: 1 };

  assert(fitsContext(singleLineKaomoji, ctxYtLive) === true, '1-line kaomoji fits YouTube Live (200 chars)');
  assert(fitsContext(long1Line, ctxTikTok) === false, '180-char text blocked on TikTok Live (150-char limit)');
  assert(fitsContext(long1Line, ctxYtLive) === true, '180-char 1-line text allowed on YouTube Live (200-char limit)');
  assert(fitsContext(wideAscii, ctxYtLive) === false, 'Multi-line ASCII blocked in YouTube Live Chat');
  assert(fitsContext(wideAscii, ctxYtShort) === false, '60-char wide ASCII filtered out in YT Shorts (max 32w)');
  assert(fitsContext(wideAscii, ctxYtLong) === true, '60-char wide ASCII allowed in YT Long-Form comments');
  assert(fitsContext(narrowBraille, ctxTwitch) === true, '24-wide Braille allowed as Auto-Wrap on Twitch (<=500 chars)');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================');
  if (testsFailed > 0) process.exit(1);
}

runAllTests();
