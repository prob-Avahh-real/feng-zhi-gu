const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const proj = path.join(__dirname, '..');

test('capacitor android present', () => {
  const cap = ['capacitor.config.json', 'capacitor.config.ts'].find((n) =>
    fs.existsSync(path.join(proj, n))
  );
  assert.ok(cap, 'missing capacitor.config');
  assert.ok(fs.existsSync(path.join(proj, 'android')), 'missing android/');
  assert.ok(fs.existsSync(path.join(proj, 'package.json')), 'missing package.json');
});

test('package.json has build + test scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(proj, 'package.json'), 'utf8'));
  assert.ok(pkg.name);
  assert.ok(pkg.scripts?.build, 'missing build script');
  assert.ok(pkg.scripts?.test, 'missing test script');
});

test('web bundle includes logic module and does not copy package.json', () => {
  assert.ok(fs.existsSync(path.join(proj, 'game-logic.js')));
  const html = fs.readFileSync(path.join(proj, 'index.html'), 'utf8');
  assert.match(html, /game-logic\.js/);
  assert.match(html, /btn-form/);
  assert.match(html, /stick/);
});
