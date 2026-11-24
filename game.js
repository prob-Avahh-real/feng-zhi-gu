const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageElement = document.getElementById('message');
const formElement = document.getElementById('form');
const areaElement = document.getElementById('area');
const hintElement = document.getElementById('hint');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TILE = 96;

const zoneMap = [
  ['wind', 'wind', 'cloud', 'cloud', 'wind', 'wind', 'wind', 'heat', 'heat', 'wind'],
  ['wind', 'cloud', 'cloud', 'water', 'water', 'water', 'cloud', 'heat', 'wind', 'wind'],
  ['wind', 'wind', 'water', 'water', 'ice', 'water', 'cloud', 'wind', 'wind', 'wind'],
  ['river', 'water', 'water', 'ice', 'ice', 'ice', 'water', 'wind', 'heat', 'wind'],
  ['river', 'river', 'water', 'water', 'wind', 'water', 'cloud', 'wind', 'heat', 'wind'],
  ['river', 'river', 'wind', 'wind', 'wind', 'water', 'cloud', 'wind', 'wind', 'wind']
];

const zoneNames = {
  wind: '空灵原野',
  cloud: '云雾森林',
  water: '溪谷水道',
  ice: '霜寒峡谷',
  river: '蒸气天穹',
  heat: '炽阳裂谷'
};

const zoneColors = {
  wind: '#1a2e4b',
  cloud: '#2b4d70',
  water: '#1a5c8f',
  ice: '#6bb3e3',
  river: '#0f4a61',
  heat: '#8f4f17'
};

const Form = {
  WIND: 'wind',
  WATER: 'water',
  ICE: 'ice'
};

const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  vx: 0,
  vy: 0,
  speed: 2.2,
  radius: 16,
  form: Form.WIND,
  canTransform: true,
  transformCooldown: 0
};

const input = { left: false, right: false, up: false, down: false, action: false, reset: false };
let lastTime = performance.now();
let messageTimeout = null;

function setMessage(text, duration = 1800) {
  messageElement.textContent = text;
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    messageElement.textContent = '';
  }, duration);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getZoneAt(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (row < 0 || row >= zoneMap.length || col < 0 || col >= zoneMap[0].length) {
    return 'wind';
  }
  return zoneMap[row][col];
}

function updateHud() {
  formElement.textContent = `形态: ${player.form === Form.WIND ? '风' : player.form === Form.WATER ? '水' : '冰'}`;
  const zone = getZoneAt(player.x, player.y);
  areaElement.textContent = `区域: ${zoneNames[zone] || '未知境地'}`;
  hintElement.textContent = '空格触发变换；在区域中体验风水冰循环。';
}

function applyMovement(delta) {
  const moveSpeed = player.speed;
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const mag = Math.hypot(dx, dy);
    player.vx = (dx / mag) * moveSpeed;
    player.vy = (dy / mag) * moveSpeed;
  } else {
    player.vx *= 0.88;
    player.vy *= 0.88;
  }

  if (input.action && player.canTransform) {
    attemptTransform();
  }

  if (input.reset) {
    resetPlayer();
  }

  player.x += player.vx * delta;
  player.y += player.vy * delta;
  player.x = clamp(player.x, player.radius, WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, HEIGHT - player.radius);
}

function attemptTransform() {
  const zone = getZoneAt(player.x, player.y);

  if (player.form === Form.WIND) {
    if (zone === 'cloud' || zone === 'water' || zone === 'river') {
      transformTo(Form.WATER);
      setMessage('风化为水，沿着溪流流动。');
    } else {
      setMessage('这里无法直接将风转化为水。');
    }
  } else if (player.form === Form.WATER) {
    if (zone === 'ice' || zone === 'river') {
      transformTo(Form.ICE);
      setMessage('水凝为冰，冻结路径。');
    } else if (zone === 'heat') {
      transformTo(Form.WIND);
      setMessage('水直接蒸发为风，回到空灵状态。');
    } else {
      setMessage('水现在还不能转化。');
    }
  } else if (player.form === Form.ICE) {
    if (zone === 'heat' || zone === 'river') {
      transformTo(Form.WATER);
      setMessage('冰融化为水，重启循环。');
    } else {
      setMessage('冰保持凝固状态。');
    }
  }

  player.canTransform = false;
  player.transformCooldown = 0.8;
}

function transformTo(nextForm) {
  player.form = nextForm;
  if (nextForm === Form.WIND) {
    player.speed = 2.4;
  } else if (nextForm === Form.WATER) {
    player.speed = 2.0;
  } else if (nextForm === Form.ICE) {
    player.speed = 1.4;
  }
}

function resetPlayer() {
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.vx = 0;
  player.vy = 0;
  player.form = Form.WIND;
  player.canTransform = true;
  player.transformCooldown = 0;
  setMessage('重置至空灵原野。');
  input.reset = false;
}

function updateState(delta) {
  if (!player.canTransform) {
    player.transformCooldown -= delta;
    if (player.transformCooldown <= 0) {
      player.canTransform = true;
      player.transformCooldown = 0;
    }
  }

  const currentZone = getZoneAt(player.x, player.y);
  if (player.form === Form.WIND && currentZone === 'water' && !input.action) {
    hintElement.textContent = '尝试按 空格，将风化为水。';
  }

  updateHud();
}

function drawGrid() {
  for (let row = 0; row < zoneMap.length; row += 1) {
    for (let col = 0; col < zoneMap[row].length; col += 1) {
      ctx.fillStyle = zoneColors[zoneMap[row][col]];
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
}

function drawPlayer() {
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

function drawZonesLabels() {
  ctx.fillStyle = 'rgba(255,255,255,0.52)';
  ctx.font = '14px Noto Sans SC, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < zoneMap.length; row += 1) {
    for (let col = 0; col < zoneMap[row].length; col += 1) {
      const label = zoneMap[row][col] === 'water' ? '水' : zoneMap[row][col] === 'ice' ? '冰' : zoneMap[row][col] === 'cloud' ? '雾' : zoneMap[row][col] === 'heat' ? '热' : zoneMap[row][col] === '风';
      ctx.fillText(label, col * TILE + TILE / 2, row * TILE + TILE / 2);
    }
  }
}

function loop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 16, 2);
  lastTime = timestamp;
  applyMovement(delta);
  updateState(delta);

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawGrid();
  drawZonesLabels();
  drawPlayer();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = true;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = true;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = true;
  if (event.code === 'Space') input.action = true;
  if (event.code === 'KeyR') input.reset = true;
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = false;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = false;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = false;
  if (event.code === 'Space') input.action = false;
  if (event.code === 'KeyR') input.reset = false;
});

setMessage('触发风水冰循环，按 空格 发动形态转换。', 2600);
updateHud();
requestAnimationFrame(loop);
