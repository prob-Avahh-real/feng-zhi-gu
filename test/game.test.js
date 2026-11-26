const test = require('node:test');
const assert = require('node:assert/strict');
const world = require('../game-logic.js');

const {
  Form,
  ZONE_GLYPHS,
  ZONE_NAMES,
  createZoneMap,
  getZoneAt,
  zoneGlyph,
  resolveTransform,
  terrainMultiplier,
  hintFor,
  spawnPoint,
  landmarksFromMap,
  cameraOrigin,
  integrateMove,
  tickCooldown,
  TILE,
  zoneAtmosphere,
  tileSeed,
  shoreFlags,
  wavePhase,
  frostOverlay,
  heatShimmerX,
  ZONE_ATMOSPHERE
} = world;

test('every zone has a Chinese glyph, including wind and river', () => {
  assert.equal(zoneGlyph('wind'), '风');
  assert.equal(zoneGlyph('river'), '汽');
  assert.equal(zoneGlyph('cloud'), '雾');
  assert.equal(zoneGlyph('water'), '水');
  assert.equal(zoneGlyph('ice'), '冰');
  assert.equal(zoneGlyph('heat'), '热');
  assert.equal(zoneGlyph('nope'), '');
  assert.deepEqual(Object.keys(ZONE_GLYPHS).sort(), Object.keys(ZONE_NAMES).sort());
});

test('open map contains all biomes and a wind spawn', () => {
  const map = createZoneMap();
  const seen = new Set(map.flat());
  for (const zone of Object.keys(ZONE_NAMES)) {
    assert.ok(seen.has(zone), `missing biome ${zone}`);
  }
  const spawn = spawnPoint(map);
  assert.equal(getZoneAt(map, spawn.x, spawn.y), 'wind');
  assert.equal(map.length, 20);
  assert.equal(map[0].length, 32);
});

test('transform rules follow zone, and do not invent a win state', () => {
  assert.equal(resolveTransform(Form.WIND, 'cloud').nextForm, Form.WATER);
  assert.equal(resolveTransform(Form.WIND, 'water').ok, true);
  assert.equal(resolveTransform(Form.WIND, 'heat').ok, false);
  assert.equal(resolveTransform(Form.WATER, 'ice').nextForm, Form.ICE);
  assert.equal(resolveTransform(Form.WATER, 'heat').nextForm, Form.WIND);
  assert.equal(resolveTransform(Form.WATER, 'wind').ok, false);
  assert.equal(resolveTransform(Form.ICE, 'river').nextForm, Form.WATER);
  assert.equal(resolveTransform(Form.ICE, 'cloud').ok, false);
  assert.equal(resolveTransform(Form.WIND, 'wind').ok, false);
});

test('terrain favors matching form without blocking travel', () => {
  assert.ok(terrainMultiplier(Form.WIND, 'wind') > terrainMultiplier(Form.WIND, 'water'));
  assert.ok(terrainMultiplier(Form.WATER, 'river') > terrainMultiplier(Form.WATER, 'heat'));
  assert.ok(terrainMultiplier(Form.ICE, 'ice') > terrainMultiplier(Form.ICE, 'heat'));
  const map = createZoneMap();
  const spawn = spawnPoint(map);
  const before = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, radius: 16, form: Form.WIND };
  const after = integrateMove(before, { ax: 1, ay: 0 }, 0.2, map);
  assert.ok(after.x > before.x);
});

test('hints describe local possibility, not a quest', () => {
  const text = hintFor(Form.WIND, 'wind');
  assert.match(text, /漫游|可化/);
  assert.doesNotMatch(text, /完成|终点|任务|通关/);
  assert.match(hintFor(Form.WIND, 'water'), /化为水/);
});

test('camera stays inside the world and landmarks exist', () => {
  const cam = cameraOrigin(10, 10, 200, 100, 400, 300);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  const inner = cameraOrigin(300, 200, 200, 100, 400, 300);
  assert.equal(inner.x, 200);
  assert.equal(inner.y, 150);
  const map = createZoneMap();
  const marks = landmarksFromMap(map);
  assert.ok(marks.length >= 6);
  const wind = marks.find((m) => m.zone === 'wind');
  assert.equal(getZoneAt(map, wind.x, wind.y), 'wind');
});

test('transform cooldown is edge-friendly', () => {
  const cooling = tickCooldown(false, 0.8, 0.3);
  assert.equal(cooling.canTransform, false);
  const ready = tickCooldown(false, 0.1, 0.3);
  assert.equal(ready.canTransform, true);
  assert.equal(ready.cooldown, 0);
  const idle = tickCooldown(true, 0, 0.16);
  assert.equal(idle.canTransform, true);
});

test('tile lookup matches map cells', () => {
  const map = createZoneMap();
  assert.equal(getZoneAt(map, TILE * 12 + 4, TILE * 10 + 4), map[10][12]);
});

test('each biome has atmosphere kind, tint, and haze', () => {
  for (const zone of Object.keys(ZONE_NAMES)) {
    const atmo = zoneAtmosphere(zone);
    assert.equal(atmo.kind, ZONE_ATMOSPHERE[zone].kind);
    assert.equal(atmo.tint.length, 3);
    assert.ok(atmo.haze > 0);
    assert.ok(atmo.motes >= 3);
  }
  assert.equal(zoneAtmosphere('nope').kind, 'wind');
});

test('shore flags mark biome edges', () => {
  const map = [
    ['wind', 'wind', 'water'],
    ['wind', 'ice', 'water'],
    ['heat', 'ice', 'ice']
  ];
  const mid = shoreFlags(map, 1, 1);
  assert.equal(mid.n, true);
  assert.equal(mid.s, false);
  assert.equal(mid.w, true);
  assert.equal(mid.e, true);
  const inland = shoreFlags(map, 0, 0);
  assert.equal(inland.n, false);
  assert.equal(inland.w, false);
});

test('ice form frosts water and river only', () => {
  assert.equal(frostOverlay('ice', 'water'), true);
  assert.equal(frostOverlay('ice', 'river'), true);
  assert.equal(frostOverlay('ice', 'heat'), false);
  assert.equal(frostOverlay('wind', 'water'), false);
});

test('procedural motion stays bounded and deterministic', () => {
  assert.equal(tileSeed(3, 4), tileSeed(3, 4));
  assert.notEqual(tileSeed(3, 4), tileSeed(4, 3));
  const wave = wavePhase(2, 5, 1.2, 'x');
  assert.ok(Math.abs(wave) <= 5);
  const shim = heatShimmerX(8, 3, 0.5, 40);
  assert.ok(Math.abs(shim) <= 2.2);
});
