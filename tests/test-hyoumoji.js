/**
 * Automated Security Audit, Dataset Integrity & Relevance Tests for hyoumoji
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
  console.log('🧪 RUNNING HYOUMOJI SECURITY & DATASET INTEGRITY TESTS');
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
  assert(fs.existsSync(path.join(ROOT_DIR, manifest.icons['48'])), 'Extension icon exists');

  // 2. Credential, Data Leak & CSS Legacy Dark Audit
  console.log('\n--- TEST 2: Credential, Data Leak & UI Integrity Audit ---');
  const contentJs = fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8');
  const contentCss = fs.readFileSync(path.join(ROOT_DIR, 'content.css'), 'utf8');
  const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');

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
  assert(forbiddenRegexes.every(rx => !rx.test(combinedSource)), 'Zero credentials, external endpoints, trackers, HTTP URLs, or eval() found');
  assert(contentCss.includes('#1e1e1e') && contentCss.includes('#e0e0e0') && contentCss.includes('#3b82f6'),
    'Legacy Dark 3-color palette (#1e1e1e, #e0e0e0, #3b82f6) applied');
  assert(contentCss.includes('grid-template-columns: repeat(2'), 'ASCII grid enforces 2+ items per row');
  assert(contentJs.includes("cache: 'no-store'"), 'Local JSON loader disables stale browser cache');

  // 3. Offline Dataset Integrity, WhatsApp Groups & Search Coverage
  console.log('\n--- TEST 3: Offline Dataset Integrity & Coverage ---');
  const emojis = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/emojis.json'), 'utf8'));
  const ascii = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/ascii.json'), 'utf8'));

  assert(Array.isArray(emojis) && emojis.length > 1800, `Loaded ${emojis.length} WhatsApp-grouped emojis`);
  const groups = new Set(emojis.map(e => e.g));
  assert(['smileys', 'animals', 'food', 'activities', 'travel', 'objects', 'symbols', 'flags'].every(g => groups.has(g)),
    'All 8 WhatsApp emoji categories present');

  assert(Array.isArray(ascii) && ascii.length > 40000, `Loaded ${ascii.length} unified ASCII items (Faces + Art + Braille)`);

  const carWholeWord = ascii.filter(x => /\b(car|cars)\b/i.test(x.k));
  const animeWholeWord = ascii.filter(x => /\banime\b/i.test(x.k));
  const brailleItems = ascii.filter(x => x.b === 1);
  assert(carWholeWord.length >= 30, `Car whole-word search coverage verified (${carWholeWord.length} results)`);
  assert(animeWholeWord.length >= 100, `Anime search coverage verified (${animeWholeWord.length} results)`);
  assert(brailleItems.length >= 100, `Braille art coverage verified (${brailleItems.length} results)`);

  const hasDangerousHtml = ascii.some(x => /<(script|iframe|img|svg)\b/i.test(x.t));
  assert(!hasDangerousHtml, 'Zero <script>/<iframe>/<img> XSS strings in compiled datasets');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================');
  if (testsFailed > 0) process.exit(1);
}

runAllTests();
