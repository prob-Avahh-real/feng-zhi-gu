const world = window.NausicaaWorld;
const {
  Form,
  ZONE_NAMES,
  ZONE_COLORS,
  TILE,
  createZoneMap,
  worldSize,
  getZoneAt,
  zoneAtmosphere,
  tileSeed,
  unitFromSeed,
  shoreFlags,
  wavePhase,
  frostOverlay,
  heatShimmerX,
  formLabel,
  resolveTransform,
  hintFor,
  spawnPoint,
  landmarksFromMap,
  cameraOrigin,
  visibleTileRange,
  integrateMove,
  tickCooldown,
  TRANSFORM_COOLDOWN
} = world;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageElement = document.getElementById('message');
const formElement = document.getElementById('form');
const areaElement = document.getElementById('area');
const hintElement = document.getElementById('hint');
const wrap = document.querySelector('.canvas-wrap');
const stickEl = document.getElementById('stick');
const knobEl = document.getElementById('stick-knob');
const btnForm = document.getElementById('btn-form');
const btnReset = document.getElementById('btn-reset');

const zoneMap = createZoneMap();
const worldBounds = worldSize(zoneMap);
const landmarks = landmarksFromMap(zoneMap);
const spawn = spawnPoint(zoneMap);

const player = {
  x: spawn.x,
  y: spawn.y,
  vx: 0,
  vy: 0,
  radius: 16,
  form: Form.WIND,
  canTransform: true,
  transformCooldown: 0
};

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  ax: 0,
  ay: 0,
  transformQueued: false
};

let viewW = 960;
let viewH = 540;
let lastTime = performance.now();
let clock = 0;
let messageTimeout = null;
let lastZone = getZoneAt(zoneMap, player.x, player.y);
let stickPointer = null;

function setMessage(text, duration = 1800) {
  messageElement.textContent = text;
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    messageElement.textContent = '';
  }, duration);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, wrap.clientWidth || window.innerWidth);
  const h = Math.max(240, wrap.clientHeight || Math.floor(window.innerHeight * 0.6));
  viewW = w;
  viewH = h;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateHud() {
  const zone = getZoneAt(zoneMap, player.x, player.y);
  formElement.textContent = `形态: ${formLabel(player.form)}`;
  areaElement.textContent = `区域: ${ZONE_NAMES[zone] || '未知境地'}`;
  hintElement.textContent = hintFor(player.form, zone);
}

function attemptTransform() {
  const zone = getZoneAt(zoneMap, player.x, player.y);
  const result = resolveTransform(player.form, zone);
  if (result.ok) player.form = result.nextForm;
  setMessage(result.message);
  player.canTransform = false;
  player.transformCooldown = TRANSFORM_COOLDOWN;
}

function resetPlayer() {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.form = Form.WIND;
  player.canTransform = true;
  player.transformCooldown = 0;
  lastZone = getZoneAt(zoneMap, player.x, player.y);
  setMessage('回到谷口的风里。');
  updateHud();
}

function step(dt) {
  clock += dt;
  const cooled = tickCooldown(player.canTransform, player.transformCooldown, dt);
  player.canTransform = cooled.canTransform;
  player.transformCooldown = cooled.cooldown;

  if (input.transformQueued) {
    input.transformQueued = false;
    if (player.canTransform) attemptTransform();
  }

  const moved = integrateMove(player, input, dt, zoneMap);
  player.x = moved.x;
  player.y = moved.y;
  player.vx = moved.vx;
  player.vy = moved.vy;

  if (moved.zone !== lastZone) {
    lastZone = moved.zone;
    setMessage(ZONE_NAMES[moved.zone] || '未知境地', 1200);
  }

  updateHud();
}

function drawGrid(cam) {
  const range = visibleTileRange(cam.x, cam.y, viewW, viewH, zoneMap);
  for (let row = range.r0; row <= range.r1; row += 1) {
    for (let col = range.c0; col <= range.c1; col += 1) {
      drawTile(col, row);
    }
  }
  for (let row = range.r0; row <= range.r1; row += 1) {
    for (let col = range.c0; col <= range.c1; col += 1) {
      drawTileMotes(col, row);
    }
  }
}

function drawTile(col, row) {
  const zone = zoneMap[row][col];
  const atmo = zoneAtmosphere(zone);
  const x = col * TILE;
  const y = row * TILE;
  const seed = tileSeed(col, row);
  ctx.fillStyle = ZONE_COLORS[zone];
  ctx.fillRect(x, y, TILE, TILE);

  const gx = x + unitFromSeed(seed, 1) * TILE;
  const gy = y + unitFromSeed(seed, 5) * TILE;
  const glow = ctx.createRadialGradient(gx, gy, 4, gx, gy, TILE * 0.85);
  glow.addColorStop(0, atmo.highlight);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.globalAlpha = 1;

  ctx.fillStyle = atmo.shadow;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(x, y + TILE * 0.62, TILE, TILE * 0.38);
  ctx.globalAlpha = 1;

  drawZoneKind(col, row, zone, x, y, seed);
  if (frostOverlay(player.form, zone)) drawFrost(x, y, seed);
  drawShores(col, row, x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeRect(x, y, TILE, TILE);
}

function drawZoneKind(col, row, zone, x, y, seed) {
  const kind = zoneAtmosphere(zone).kind;
  if (kind === 'wind') drawWindGrass(x, y, seed);
  else if (kind === 'fog') drawCloudCanopy(x, y, seed);
  else if (kind === 'ripple') drawWaterSurface(col, row, x, y);
  else if (kind === 'glint') drawIceSheet(x, y, seed);
  else if (kind === 'steam') drawRiverSteam(col, row, x, y, seed);
  else if (kind === 'ember') drawHeatGround(col, row, x, y, seed);
}

function drawWindGrass(x, y, seed) {
  ctx.strokeStyle = 'rgba(130, 190, 160, 0.45)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i += 1) {
    const bx = x + 8 + unitFromSeed(seed, i + 2) * (TILE - 16);
    const by = y + 20 + unitFromSeed(seed, i + 9) * (TILE - 24);
    const sway = Math.sin(clock * 2.2 + bx * 0.04) * 5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sway * 0.4, by - 10, bx + sway, by - 16);
    ctx.stroke();
  }
}

function drawCloudCanopy(x, y, seed) {
  ctx.fillStyle = 'rgba(18, 36, 52, 0.42)';
  for (let i = 0; i < 2; i += 1) {
    const tx = x + 12 + unitFromSeed(seed, i + 3) * (TILE - 24);
    const ty = y + 28 + unitFromSeed(seed, i + 7) * 18;
    ctx.beginPath();
    ctx.moveTo(tx, y + TILE - 6);
    ctx.lineTo(tx - 10, ty);
    ctx.lineTo(tx + 10, ty);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(210, 228, 240, 0.16)';
  ctx.beginPath();
  ctx.ellipse(
    x + TILE * 0.5,
    y + 18 + Math.sin(clock * 0.6 + seed) * 4,
    22,
    10,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawWaterSurface(col, row, x, y) {
  ctx.strokeStyle = 'rgba(180, 230, 255, 0.28)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i += 1) {
    const yy = y + 14 + i * 16 + wavePhase(col, row, clock, 'y');
    ctx.beginPath();
    ctx.moveTo(x + 4, yy);
    ctx.quadraticCurveTo(x + TILE / 2, yy + wavePhase(col, row, clock + i, 'x') * 0.4, x + TILE - 4, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const spark = (Math.sin(clock * 5 + col + row) + 1) * 0.5;
  if (spark > 0.75) {
    ctx.beginPath();
    ctx.arc(x + TILE * 0.35, y + TILE * 0.4, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIceSheet(x, y, seed) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.lineTo(x + 22, y + 28);
  ctx.lineTo(x + 18, y + 50);
  ctx.moveTo(x + 40, y + 8);
  ctx.lineTo(x + 36, y + 36);
  ctx.stroke();
  const glint = (Math.sin(clock * 3.2 + seed) + 1) * 0.5;
  ctx.fillStyle = `rgba(255,255,255,${0.12 + glint * 0.28})`;
  ctx.beginPath();
  ctx.ellipse(x + 44, y + 18, 7, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawRiverSteam(col, row, x, y, seed) {
  ctx.strokeStyle = 'rgba(120, 210, 220, 0.3)';
  ctx.lineWidth = 1.2;
  const drift = (clock * 28 + row * 6) % TILE;
  for (let i = 0; i < 3; i += 1) {
    const yy = y + 12 + i * 18;
    ctx.beginPath();
    ctx.moveTo(x - 4 + drift, yy);
    ctx.lineTo(x + 22 + drift, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(210, 230, 235, 0.14)';
  const puffY = y + TILE - ((clock * 22 + unitFromSeed(seed, 6) * 40) % (TILE + 10));
  ctx.beginPath();
  ctx.ellipse(x + 18 + Math.sin(clock + col) * 6, puffY, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeatGround(col, row, x, y, seed) {
  ctx.strokeStyle = 'rgba(40, 16, 8, 0.45)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 20);
  ctx.lineTo(x + 20, y + 36);
  ctx.lineTo(x + 14, y + 54);
  ctx.moveTo(x + 38, y + 12);
  ctx.lineTo(x + 48, y + 40);
  ctx.stroke();
  const shift = heatShimmerX(col, row, clock, y);
  ctx.fillStyle = 'rgba(255, 140, 40, 0.12)';
  ctx.fillRect(x + shift, y, TILE, TILE);
}

function drawFrost(x, y, seed) {
  ctx.fillStyle = 'rgba(210, 235, 255, 0.22)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 10 + unitFromSeed(seed, 2) * 8, y + 8);
  ctx.lineTo(x + 28, y + 26);
  ctx.stroke();
}

function drawShores(col, row, x, y) {
  const flags = shoreFlags(zoneMap, col, row);
  const zone = zoneMap[row][col];
  ctx.strokeStyle = zone === 'water' || zone === 'ice'
    ? 'rgba(230, 250, 255, 0.35)'
    : 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (flags.n) {
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + TILE, y + 1);
  }
  if (flags.s) {
    ctx.moveTo(x, y + TILE - 1);
    ctx.lineTo(x + TILE, y + TILE - 1);
  }
  if (flags.w) {
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + 1, y + TILE);
  }
  if (flags.e) {
    ctx.moveTo(x + TILE - 1, y);
    ctx.lineTo(x + TILE - 1, y + TILE);
  }
  ctx.stroke();
}

function drawTileMotes(col, row) {
  const zone = zoneMap[row][col];
  const atmo = zoneAtmosphere(zone);
  const seed = tileSeed(col, row);
  const x = col * TILE;
  const y = row * TILE;
  for (let i = 0; i < atmo.motes; i += 1) {
    const u = unitFromSeed(seed, i + 11);
    const v = unitFromSeed(seed, i + 17);
    if (atmo.kind === 'ember') {
      const rise = ((clock * 30 + v * 50) % (TILE + 16));
      ctx.fillStyle = 'rgba(255, 170, 70, 0.55)';
      ctx.beginPath();
      ctx.arc(x + u * TILE, y + TILE - rise, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (atmo.kind === 'fog') {
      const drift = (clock * 12 + u * 80) % (TILE + 30);
      ctx.fillStyle = 'rgba(230, 240, 248, 0.1)';
      ctx.beginPath();
      ctx.ellipse(x + drift, y + v * TILE, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (atmo.kind === 'wind') {
      const drift = (clock * 40 + v * 60) % (TILE + 20);
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(x + drift - 10, y + u * TILE);
      ctx.lineTo(x + drift + 8, y + u * TILE - 2);
      ctx.stroke();
    } else if (atmo.kind === 'glint') {
      const pulse = (Math.sin(clock * 4 + u * 10) + 1) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + pulse * 0.35})`;
      ctx.fillRect(x + u * TILE, y + v * TILE, 3, 3);
    }
  }
}

function drawLandmarks() {
  ctx.fillStyle = 'rgba(232, 247, 255, 0.86)';
  ctx.font = '16px Noto Sans SC, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  for (const mark of landmarks) {
    ctx.fillText(mark.name, mark.x, mark.y - 22);
  }
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  const zone = getZoneAt(zoneMap, player.x, player.y);
  const trail = zoneAtmosphere(zone);
  ctx.fillStyle = `rgba(${trail.tint.join(',')}, 0.12)`;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 10 + Math.sin(clock * 3) * 2, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(player.x - 6, player.y - 6, 8, player.x, player.y, 30);
  if (player.form === Form.WIND) {
    gradient.addColorStop(0, 'rgba(207, 243, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(42, 206, 255, 0.02)');
  } else if (player.form === Form.WATER) {
    gradient.addColorStop(0, 'rgba(166, 229, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(22, 120, 186, 0.12)');
  } else {
    gradient.addColorStop(0, 'rgba(236, 247, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(98, 185, 241, 0.14)');
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawAmbient(zone) {
  const atmo = zoneAtmosphere(zone);
  const g = ctx.createRadialGradient(viewW * 0.5, viewH * 0.45, viewH * 0.15, viewW * 0.5, viewH * 0.5, viewH * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(${atmo.tint.join(',')}, ${atmo.haze})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  if (atmo.kind === 'fog') {
    ctx.fillStyle = 'rgba(200, 220, 235, 0.08)';
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  step(dt);

  const cam = cameraOrigin(player.x, player.y, viewW, viewH, worldBounds.width, worldBounds.height);
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGrid(cam);
  drawLandmarks();
  drawPlayer();
  ctx.restore();
  drawAmbient(getZoneAt(zoneMap, player.x, player.y));

  requestAnimationFrame(loop);
}

function queueTransform(event) {
  if (event && event.repeat) return;
  input.transformQueued = true;
}

function keyFlags(event) {
  const code = event.code || '';
  const key = (event.key || '').toLowerCase();
  return {
    left: code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'arrowleft',
    right: code === 'ArrowRight' || code === 'KeyD' || key === 'd' || key === 'arrowright',
    up: code === 'ArrowUp' || code === 'KeyW' || key === 'w' || key === 'arrowup',
    down: code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'arrowdown',
    transform: code === 'Space' || code === 'KeyE' || key === ' ' || key === 'e',
    reset: code === 'KeyR' || key === 'r'
  };
}

window.addEventListener('keydown', (event) => {
  const flags = keyFlags(event);
  if (flags.left || flags.right || flags.up || flags.down || flags.transform) {
    event.preventDefault();
  }
  if (flags.left) input.left = true;
  if (flags.right) input.right = true;
  if (flags.up) input.up = true;
  if (flags.down) input.down = true;
  if (flags.transform) queueTransform(event);
  if (flags.reset && !event.repeat) resetPlayer();
});

window.addEventListener('keyup', (event) => {
  const flags = keyFlags(event);
  if (flags.left) input.left = false;
  if (flags.right) input.right = false;
  if (flags.up) input.up = false;
  if (flags.down) input.down = false;
});

function setStickFromEvent(event) {
  const rect = stickEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const max = rect.width / 2 - 8;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const mag = Math.hypot(dx, dy);
  if (mag > max) {
    dx = (dx / mag) * max;
    dy = (dy / mag) * max;
  }
  input.ax = dx / max;
  input.ay = dy / max;
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetStick() {
  stickPointer = null;
  input.ax = 0;
  input.ay = 0;
  knobEl.style.transform = 'translate(0px, 0px)';
}

stickEl.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  try {
    stickEl.setPointerCapture(event.pointerId);
  } catch (_err) {
    /* synthetic / non-capturable pointers still drive the stick */
  }
  stickPointer = event.pointerId;
  setStickFromEvent(event);
});

stickEl.addEventListener('pointermove', (event) => {
  if (stickPointer !== event.pointerId) return;
  event.preventDefault();
  setStickFromEvent(event);
});

stickEl.addEventListener('pointerup', (event) => {
  if (stickPointer !== event.pointerId) return;
  resetStick();
});

stickEl.addEventListener('pointercancel', resetStick);

btnForm.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  queueTransform();
});

btnReset.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  resetPlayer();
});

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
setMessage('风之谷没有尽头，随地气改换形态即可。', 2600);
updateHud();
requestAnimationFrame(loop);
