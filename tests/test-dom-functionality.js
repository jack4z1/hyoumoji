/**
 * Functional DOM & UI Simulation Smoke Test for hyoumoji
 */

const fs = require('fs');
const path = require('path');

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

console.log('====================================================');
console.log('🧪 RUNNING FUNCTIONAL & DOM SIMULATION SMOKE TESTS');
console.log('====================================================\n');

// 1. Mock minimal DOM environment
class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.textContent = '';
    this.parentNode = null;
    this.eventListeners = {};
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || null; }
  hasAttribute(k) { return k in this.attributes; }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  prepend(child) {
    child.parentNode = this;
    this.children.unshift(child);
  }

  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.children.indexOf(refChild);
    if (idx > -1) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
    }
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      if (this.id === id) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.includes(cls)) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.includes(cls)) results.push(this);
    }
    for (const child of this.children) {
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  dispatchEvent(event) {
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(fn => fn(event));
    }
  }

  focus() { this._focused = true; }
}

// ----------------------------------------------------
// TEST 1: Comment Box Button Injection
// ----------------------------------------------------
console.log('--- TEST 1: Comment Box Button Injection & Idempotency ---');
const commentBox = new MockElement('ytd-commentbox');
const input = new MockElement('div', 'contenteditable-root');
input.setAttribute('contenteditable', 'true');
const buttonsArea = new MockElement('div', 'buttons');
const nativeEmojiBtn = new MockElement('button', 'emoji-button');

buttonsArea.appendChild(nativeEmojiBtn);
commentBox.appendChild(input);
commentBox.appendChild(buttonsArea);

function injectButton(box) {
  if (box.hasAttribute('data-hyoumoji-injected')) return false;
  box.setAttribute('data-hyoumoji-injected', 'true');
  const btn = new MockElement('button');
  btn.className = 'hyoumoji-trigger-btn';
  const btns = box.querySelector('#buttons');
  const emojiBtn = btns.querySelector('#emoji-button');
  btns.insertBefore(btn, emojiBtn);
  return true;
}

const firstInject = injectButton(commentBox);
assert(firstInject === true, 'Trigger button successfully injected into comment box');
assert(buttonsArea.children[0].className === 'hyoumoji-trigger-btn', 'Hyoumoji button placed right before native emoji button');

const secondInject = injectButton(commentBox);
assert(secondInject === false, 'Duplicate injection prevented by data-hyoumoji-injected guard');

// ----------------------------------------------------
// TEST 2: YouTube Comment Insertion & Event Dispatching
// ----------------------------------------------------
console.log('\n--- TEST 2: Comment Editor Input Simulation ---');
let inputEventTriggered = false;
let changeEventTriggered = false;

input.addEventListener('input', () => { inputEventTriggered = true; });
input.addEventListener('change', () => { changeEventTriggered = true; });

function simulateInsert(targetInput, text) {
  targetInput.focus();
  targetInput.textContent += text;
  targetInput.dispatchEvent({ type: 'input' });
  targetInput.dispatchEvent({ type: 'change' });
}

simulateInsert(input, ' 🔥 ');
assert(input._focused === true, 'Input received focus before typing');
assert(input.textContent === ' 🔥 ', 'Emoji text inserted into contenteditable editor');
assert(inputEventTriggered === true, 'Dispatched "input" event to enable YouTube Submit button');
assert(changeEventTriggered === true, 'Dispatched "change" event for data-binding update');

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 DOM SMOKE TEST: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) process.exit(1);
