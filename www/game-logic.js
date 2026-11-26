(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.NausicaaWorld = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const Form = {
    WIND: 'wind',
    WATER: 'water',
    ICE: 'ice'
  };

  const ZONE_NAMES = {
    wind: '空灵原野',
    cloud: '云雾森林',
    water: '溪谷水道',
    ice: '霜寒峡谷',
    river: '蒸气天穹',
    heat: '炽阳裂谷'
  };

  const ZONE_COLORS = {
    wind: '#1a2e4b',
    cloud: '#2b4d70',
    water: '#1a5c8f',
    ice: '#6bb3e3',
    river: '#0f4a61',
    heat: '#8f4f17'
  };

  const ZONE_ATMOSPHERE = {
    wind: {
      highlight: '#2a4a6e',
      shadow: '#0d1a2c',
      tint: [42, 110, 160],
      haze: 0.07,
      motes: 3,
      kind: 'wind'
    },
    cloud: {
      highlight: '#3d6188',
      shadow: '#1a3148',
      tint: [150, 175, 198],
      haze: 0.2,
      motes: 5,
      kind: 'fog'
    },
    water: {
      highlight: '#2a7ab0',
      shadow: '#0d3a5c',
      tint: [30, 90, 150],
      haze: 0.1,
      motes: 4,
      kind: 'ripple'
    },
    ice: {
      highlight: '#c8e8ff',
      shadow: '#3d7aa8',
      tint: [190, 225, 255],
      haze: 0.12,
      motes: 4,
      kind: 'glint'
    },
    river: {
      highlight: '#1a6a7a',
      shadow: '#08323f',
      tint: [70, 140, 150],
      haze: 0.16,
      motes: 5,
      kind: 'steam'
    },
    heat: {
      highlight: '#c46a28',
      shadow: '#4a220c',
      tint: [210, 90, 30],
      haze: 0.18,
      motes: 5,
      kind: 'ember'
    }
  };

  const ZONE_GLYPHS = {
    wind: '风',
    cloud: '雾',
    water: '水',
    ice: '冰',
    river: '汽',
    heat: '热'
  };

  const TILE = 64;
  const MAP_COLS = 32;
  const MAP_ROWS = 20;
  const TRANSFORM_COOLDOWN = 0.8;

  const FORM_LABELS = {
    [Form.WIND]: '风',
    [Form.WATER]: '水',
    [Form.ICE]: '冰'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fillRect(map, c0, r0, c1, r1, zone) {
    const rows = map.length;
    const cols = map[0].length;
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) map[r][c] = zone;
      }
    }
  }

  function fillCircle(map, cx, cy, radius, zone) {
    const rows = map.length;
    const cols = map[0].length;
    const r2 = radius * radius;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const dx = c - cx;
        const dy = r - cy;
        if (dx * dx + dy * dy <= r2) map[r][c] = zone;
      }
    }
  }

  function createZoneMap(cols = MAP_COLS, rows = MAP_ROWS) {
    const map = Array.from({ length: rows }, () => Array(cols).fill('wind'));
    fillRect(map, 7, 0, 17, 6, 'cloud');
    fillRect(map, 21, 13, cols - 1, rows - 1, 'cloud');
    fillCircle(map, 12, 10, 5.2, 'water');
    fillCircle(map, 12, 10, 2.3, 'ice');
    fillRect(map, 0, 8, 8, 12, 'river');
    fillRect(map, 8, 9, 11, 11, 'river');
    fillRect(map, 22, 1, cols - 1, 8, 'heat');
    fillCircle(map, 24, 12, 2.5, 'water');
    fillRect(map, 1, 15, 9, rows - 1, 'river');
    fillCircle(map, 18, 5, 2.1, 'water');
    fillCircle(map, 27, 4, 1.6, 'heat');
    return map;
  }

  function worldSize(map, tile = TILE) {
    return {
      width: map[0].length * tile,
      height: map.length * tile
    };
  }

  function getZoneAt(map, x, y, tile = TILE) {
    const col = Math.floor(x / tile);
    const row = Math.floor(y / tile);
    if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
      return 'wind';
    }
    return map[row][col];
  }

  function zoneGlyph(zone) {
    return ZONE_GLYPHS[zone] || '';
  }

  function zoneAtmosphere(zone) {
    return ZONE_ATMOSPHERE[zone] || ZONE_ATMOSPHERE.wind;
  }

  function tileSeed(col, row) {
    return ((Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663)) >>> 0);
  }

  function unitFromSeed(seed, slot) {
    return ((seed >>> (slot % 24)) & 255) / 255;
  }

  function shoreFlags(map, col, row) {
    const zone = map[row][col];
    const rows = map.length;
    const cols = map[0].length;
    return {
      n: row > 0 && map[row - 1][col] !== zone,
      s: row < rows - 1 && map[row + 1][col] !== zone,
      w: col > 0 && map[row][col - 1] !== zone,
      e: col < cols - 1 && map[row][col + 1] !== zone
    };
  }

  function wavePhase(col, row, time, axis) {
    const seed = unitFromSeed(tileSeed(col, row), axis === 'y' ? 8 : 2);
    if (axis === 'y') return Math.sin(time * 1.15 + row * 0.55 + seed * 6) * 4;
    return Math.sin(time * 1.6 + col * 0.8 + seed * 5) * 5;
  }

  function frostOverlay(form, zone) {
    return form === Form.ICE && (zone === 'water' || zone === 'river');
  }

  function heatShimmerX(col, row, time, y) {
    const seed = unitFromSeed(tileSeed(col, row), 4);
    return Math.sin(time * 7 + y * 0.12 + seed * 8) * 2.2;
  }

  function formLabel(form) {
    return FORM_LABELS[form] || form;
  }

  function resolveTransform(form, zone) {
    if (form === Form.WIND) {
      if (zone === 'cloud' || zone === 'water' || zone === 'river') {
        return { ok: true, nextForm: Form.WATER, message: '风化为水，沿着溪流漫开。' };
      }
      return { ok: false, nextForm: form, message: '这里的风还聚不成水。' };
    }
    if (form === Form.WATER) {
      if (zone === 'ice' || zone === 'river') {
        return { ok: true, nextForm: Form.ICE, message: '水凝为冰，谷地变得清脆。' };
      }
      if (zone === 'heat') {
        return { ok: true, nextForm: Form.WIND, message: '水遇炽阳，蒸发回风。' };
      }
      return { ok: false, nextForm: form, message: '这片水域还不愿改换形态。' };
    }
    if (form === Form.ICE) {
      if (zone === 'heat' || zone === 'river') {
        return { ok: true, nextForm: Form.WATER, message: '冰融为水，继续向低处流。' };
      }
      return { ok: false, nextForm: form, message: '冰仍凝在原处。' };
    }
    return { ok: false, nextForm: form, message: '形态未知。' };
  }

  function formBaseSpeed(form) {
    if (form === Form.WIND) return 168;
    if (form === Form.WATER) return 142;
    return 108;
  }

  function terrainMultiplier(form, zone) {
    if (form === Form.WIND) {
      if (zone === 'wind' || zone === 'cloud') return 1.18;
      if (zone === 'heat') return 1.05;
      if (zone === 'water' || zone === 'river') return 0.72;
      if (zone === 'ice') return 0.8;
    }
    if (form === Form.WATER) {
      if (zone === 'water' || zone === 'river') return 1.28;
      if (zone === 'cloud') return 1.05;
      if (zone === 'heat') return 0.7;
      if (zone === 'ice') return 0.62;
    }
    if (form === Form.ICE) {
      if (zone === 'ice') return 1.35;
      if (zone === 'water') return 0.88;
      if (zone === 'heat') return 0.55;
      if (zone === 'wind') return 0.78;
    }
    return 1;
  }

  function riverCurrent(zone, form) {
    if (zone !== 'river') return { x: 0, y: 0 };
    const scale = form === Form.WATER ? 42 : form === Form.ICE ? 8 : 18;
    return { x: scale, y: 0 };
  }

  function velocityDamping(form, zone) {
    if (form === Form.ICE && zone === 'ice') return 1.15;
    if (form === Form.WATER && (zone === 'water' || zone === 'river')) return 3.4;
    if (form === Form.WIND) return 5.2;
    return 4.4;
  }

  function hintFor(form, zone) {
    const result = resolveTransform(form, zone);
    if (result.ok) {
      return `此地可化为${formLabel(result.nextForm)}`;
    }
    if (form === Form.WIND) return '乘风漫游，雾、水、汽处可化为水';
    if (form === Form.WATER) return '顺流而行，霜谷或蒸气可凝冰，裂谷可蒸发';
    return '冰面易滑；热谷或蒸气可融化';
  }

  function spawnPoint(map, tile = TILE) {
    for (let r = 2; r < map.length; r += 1) {
      for (let c = 2; c < map[0].length; c += 1) {
        if (map[r][c] === 'wind') {
          return { x: c * tile + tile / 2, y: r * tile + tile / 2 };
        }
      }
    }
    return { x: tile * 2, y: tile * 2 };
  }

  function landmarksFromMap(map, tile = TILE) {
    const rows = map.length;
    const cols = map[0].length;
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
    const best = {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (seen[r][c]) continue;
        const zone = map[r][c];
        const queue = [[c, r]];
        seen[r][c] = true;
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let i = 0; i < queue.length; i += 1) {
          const cc = queue[i][0];
          const rr = queue[i][1];
          sx += cc * tile + tile / 2;
          sy += rr * tile + tile / 2;
          n += 1;
          for (let d = 0; d < dirs.length; d += 1) {
            const nc = cc + dirs[d][0];
            const nr = rr + dirs[d][1];
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen[nr][nc]) continue;
            if (map[nr][nc] !== zone) continue;
            seen[nr][nc] = true;
            queue.push([nc, nr]);
          }
        }
        if (!best[zone] || n > best[zone].n) {
          best[zone] = { x: sx / n, y: sy / n, n };
        }
      }
    }
    return Object.keys(ZONE_NAMES).map((zone) => {
      const a = best[zone];
      if (!a) return null;
      return { zone, name: ZONE_NAMES[zone], x: a.x, y: a.y };
    }).filter(Boolean);
  }

  function cameraOrigin(playerX, playerY, viewW, viewH, worldW, worldH) {
    const x = clamp(playerX - viewW / 2, 0, Math.max(0, worldW - viewW));
    const y = clamp(playerY - viewH / 2, 0, Math.max(0, worldH - viewH));
    return { x, y };
  }

  function visibleTileRange(camX, camY, viewW, viewH, map, tile = TILE) {
    const cols = map[0].length;
    const rows = map.length;
    return {
      c0: clamp(Math.floor(camX / tile) - 1, 0, cols - 1),
      r0: clamp(Math.floor(camY / tile) - 1, 0, rows - 1),
      c1: clamp(Math.ceil((camX + viewW) / tile) + 1, 0, cols - 1),
      r1: clamp(Math.ceil((camY + viewH) / tile) + 1, 0, rows - 1)
    };
  }

  function integrateMove(state, input, dt, map, tile = TILE) {
    const zone = getZoneAt(map, state.x, state.y, tile);
    const speed = formBaseSpeed(state.form) * terrainMultiplier(state.form, zone);
    let dx = input.ax || 0;
    let dy = input.ay || 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    const mag = Math.hypot(dx, dy);
    let vx = state.vx;
    let vy = state.vy;
    if (mag > 0.001) {
      const nx = dx / mag;
      const ny = dy / mag;
      vx = nx * speed;
      vy = ny * speed;
    } else {
      const damp = Math.exp(-velocityDamping(state.form, zone) * dt);
      vx *= damp;
      vy *= damp;
    }
    const current = riverCurrent(zone, state.form);
    vx += current.x;
    vy += current.y;

    const world = worldSize(map, tile);
    const radius = state.radius;
    let x = clamp(state.x + vx * dt, radius, world.width - radius);
    let y = clamp(state.y + vy * dt, radius, world.height - radius);
    return { x, y, vx, vy, zone };
  }

  function tickCooldown(canTransform, cooldown, dt, duration = TRANSFORM_COOLDOWN) {
    if (canTransform) return { canTransform: true, cooldown: 0 };
    const next = cooldown - dt;
    if (next <= 0) return { canTransform: true, cooldown: 0 };
    return { canTransform: false, cooldown: next };
  }

  return {
    Form,
    ZONE_NAMES,
    ZONE_COLORS,
    ZONE_ATMOSPHERE,
    ZONE_GLYPHS,
    TILE,
    MAP_COLS,
    MAP_ROWS,
    TRANSFORM_COOLDOWN,
    clamp,
    createZoneMap,
    worldSize,
    getZoneAt,
    zoneGlyph,
    zoneAtmosphere,
    tileSeed,
    unitFromSeed,
    shoreFlags,
    wavePhase,
    frostOverlay,
    heatShimmerX,
    formLabel,
    resolveTransform,
    formBaseSpeed,
    terrainMultiplier,
    riverCurrent,
    hintFor,
    spawnPoint,
    landmarksFromMap,
    cameraOrigin,
    visibleTileRange,
    integrateMove,
    tickCooldown
  };
});
