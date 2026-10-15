import * as C from "./constants";
import {
  at,
  put,
  tile,
  cell,
  copy,
  fresh,
  generate,
  maxFuel,
  maxHull,
  slots,
  load,
  jet,
  grounded,
  solidTop,
  depth,
  camera,
  clamp,
  effect,
  note,
  type DeepcoreState,
  type ReadState,
} from "./model";
const SAVE_KEY = "deepcore.expedition.v1";
export function readSave(): Partial<DeepcoreState> | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(SAVE_KEY) ?? "null",
    ) as Partial<DeepcoreState> | null;
    return value?.mine && value?.tiers ? value : null;
  } catch {
    return null;
  }
}
export function clearSave(s: DeepcoreState) {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Storage may be blocked. */
  }
  s.hasSave = false;
}
export function save(s: DeepcoreState) {
  if (s.coreTimer !== null) {
    note(s, "Unstable Sample: saving refused.");
    return;
  }
  try {
    const {
      assets: _assets,
      effects: _effects,
      sounds: _sounds,
      ...payload
    } = s;
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    s.hasSave = true;
    note(s, "Expedition secured.");
  } catch {
    note(s, "Storage unavailable. Expedition not saved.");
  }
}
export function restore(s: DeepcoreState) {
  const value = readSave();
  if (!value) {
    note(s, "No saved expedition.");
    return s;
  }
  const next = {
    ...fresh(s.assets, true),
    ...value,
    assets: s.assets,
  } as DeepcoreState;
  next.screen = "in-mine";
  next.panel = null;
  next.menuIndex = 0;
  next.miner = {
    ...next.miner,
    x: C.SPAWN_COL * C.TILE + 12,
    y: C.SURFACE_Y - C.MINER_H,
    vx: 0,
    vy: 0,
    drilling: null,
  };
  next.coreTimer = null;
  next.coreGround = null;
  next.satchel.coreSample = false;
  next.elapsedSeconds = 0;
  next.deepestDepthMeters = 0;
  next.creditsEarned = 0;
  next.summary = null;
  next.effects = [];
  next.sounds = [];
  next.muted = s.muted;
  camera(next, 0);
  return next;
}
export function start(s: ReadState) {
  const n = fresh(s.assets as DeepcoreState["assets"]);
  n.mode = s.mode;
  n.worldSize = s.worldSize;
  n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[n.worldSize]);
  n.screen = "in-mine";
  n.muted = s.muted;
  n.simTime = s.simTime;
  generate(n);
  clearSave(n);
  camera(n, 0);
  note(n, "Welcome to the camp. Dig, return, sell. Build your way home.");
  return n;
}
export function finish(s: DeepcoreState, cause: C.DeathCause | null) {
  if (s.summary) return;
  s.summary = {
    deepestDepthMeters: s.deepestDepthMeters,
    creditsEarned: s.creditsEarned,
    elapsedSeconds: s.elapsedSeconds,
    mode: s.mode,
    componentsInstalled: s.installed,
    deathCause: cause,
  };
  s.screen = cause ? "game-over" : "victory";
  s.panel = null;
  s.menuIndex = 0;
  s.coreTimer = null;
  s.coreGround = null;
  s.satchel.coreSample = false;
  s.miner.drilling = null;
  if (!cause || s.mode === "hardcore") clearSave(s);
  if (cause) {
    s.sounds.push(C.CUES.death);
    effect(s, "death-burst", s.miner.x + 28, s.miner.y + 36);
  } else {
    s.sounds.push(C.CUES.launch);
    effect(s, "launch-exhaust", 1750, 75);
  }
}
function hurt(s: DeepcoreState, amount: number, hazard?: C.NoticeHazard) {
  if (amount <= 0) return;
  s.miner.hull = Math.max(0, s.miner.hull - amount);
  s.hurt = C.HURT_TIME;
  if (s.miner.hull <= 0) finish(s, "hull-destroyed");
  if (hazard && !s.noticesFired[hazard]) {
    s.noticesFired[hazard] = true;
    s.notice = { hazard, age: 0 };
  }
}
export function gas(s: DeepcoreState, col: number, row: number) {
  const x = (col + 0.5) * C.TILE,
    y = (row + 0.5) * C.TILE;
  effect(s, "gas-explosion", x, y);
  s.sounds.push(C.CUES.gasExplosion);
  s.shake = 1;
  const dx = s.miner.x + 28 - x,
    dy = s.miner.y + 36 - y,
    d = Math.hypot(dx, dy);
  if (d <= C.GAS_BLAST_TILES * C.TILE) {
    hurt(
      s,
      C.GAS_DAMAGE_MIN +
        ((C.GAS_DAMAGE_MAX - C.GAS_DAMAGE_MIN) *
          Math.max(0, (row - 1) / (s.coreRow - 1) - 0.25)) /
          0.75,
      "gas",
    );
    if (s.miner.travel) {
      s.miner.vx = (dx / (d || 1)) * C.GAS_KNOCKBACK;
      s.miner.vy = (dy / (d || 1)) * C.GAS_KNOCKBACK;
    }
  }
}
export function useItem(s: DeepcoreState, id: C.ItemId) {
  if (!s.items[id]) {
    note(s, "No supply held.");
    return;
  }
  const m = s.miner,
    p = cell(s);
  if (
    (id === "nanobots" && m.hull >= maxHull(s)) ||
    (id === "emergency-fuel" && m.fuel >= maxFuel(s))
  ) {
    note(s, "Already full.");
    return;
  }
  if (id === "dynamite" || id === "plastic-explosives") {
    const r =
      id === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
    let changed = false;
    for (let y = p.row - r; y <= p.row + r; y++)
      for (let x = p.col - r; x <= p.col + r; x++) {
        const t = at(s, x, y);
        if (
          y > 0 &&
          x > 0 &&
          x < 31 &&
          y < s.coreRow &&
          !["bedrock", "core", "material", "tunnel"].includes(t.kind)
        ) {
          changed = true;
          put(s, x, y, tile("tunnel", t.band));
          if (t.kind === "gas") gas(s, x, y);
        }
      }
    if (!changed) {
      note(s, "Nothing to blast here.");
      return;
    }
    effect(s, "gas-explosion", m.x + 28, m.y + 36);
    s.sounds.push(C.CUES.gasExplosion);
    s.shake = 1;
  } else if (id === "nanobots")
    m.hull = Math.min(maxHull(s), m.hull + C.NANOBOT_HULL);
  else if (id === "emergency-fuel")
    m.fuel = Math.min(maxFuel(s), m.fuel + C.EMERGENCY_FUEL);
  else {
    m.x = C.SPAWN_COL * C.TILE + 12;
    m.y = C.SURFACE_Y - C.MINER_H;
    m.vx = 0;
    m.vy = 0;
    if (id === "quantum-teleporter") {
      m.y -=
        (s.nextTeleportHeight ??
          C.TELEPORT_HEIGHT_TILES_MIN +
            Math.random() *
              (C.TELEPORT_HEIGHT_TILES_MAX - C.TELEPORT_HEIGHT_TILES_MIN)) *
        C.TILE;
      m.vy =
        s.nextTeleportSpeed ??
        C.TELEPORT_SPEED_MIN +
          Math.random() * (C.TELEPORT_SPEED_MAX - C.TELEPORT_SPEED_MIN);
      s.nextTeleportHeight = null;
      s.nextTeleportSpeed = null;
    }
    m.drilling = null;
    effect(s, "core-extract", m.x + 28, m.y + 36);
  }
  s.items[id]--;
  s.sounds.push(C.CUES.fabricate);
  note(s, "Supply deployed.");
}
export function transact(
  s: DeepcoreState,
  control: string,
  subject: string | null = null,
) {
  const ore = subject as C.OreId,
    track = subject as C.TrackName,
    id = subject as C.ItemId;
  if (control === "drop-ore") {
    if (s.ore[ore]) {
      s.ore[ore]!--;
      if (s.ore[ore] === 0) delete s.ore[ore];
    }
    return;
  }
  if (control === "sell") {
    const value = C.MINERALS.reduce(
      (n, m) => n + (s.ore[m.id] ?? 0) * m.value,
      0,
    );
    s.credits += value;
    s.creditsEarned += value;
    s.ore = {};
    note(s, `Cargo sold · +${value} Credits`);
    if (value) s.sounds.push(C.CUES.fabricate);
    return;
  }
  if (
    ["buy-fuel", "fill-fuel", "buy-repair", "repair-full"].includes(control)
  ) {
    const fuel = control.includes("fuel"),
      max = fuel ? maxFuel(s) : maxHull(s),
      held = fuel ? s.miner.fuel : s.miner.hull,
      price = fuel ? C.FUEL_PRICE : C.REPAIR_PRICE;
    const quantity = Math.max(
      0,
      Math.min(
        max - held,
        s.credits / price,
        control.startsWith("buy")
          ? fuel
            ? C.FUEL_BUY_INCREMENT
            : C.REPAIR_BUY_INCREMENT
          : Infinity,
      ),
    );
    s.credits -= quantity * price;
    if (fuel) s.miner.fuel += quantity;
    else s.miner.hull += quantity;
    if (quantity) s.sounds.push(C.CUES.fabricate);
    return;
  }
  if (control === "buy-upgrade") {
    const level = s.tiers[track],
      price = C.UPGRADE_PRICES[level - 1];
    if (level >= C.MAX_TIER[track] || s.credits < price) {
      note(s, "Upgrade unavailable.");
      return;
    }
    const f = maxFuel(s),
      h = maxHull(s);
    s.credits -= price;
    s.tiers[track]++;
    s.miner.fuel += maxFuel(s) - f;
    s.miner.hull += maxHull(s) - h;
    s.sounds.push(C.CUES.fabricate);
    return;
  }
  if (control === "buy-item") {
    const item = C.ITEMS.find((i) => i.id === id);
    if (!item) throw new RangeError("Unknown supply");
    if (s.credits < item.price) {
      note(s, "Not enough Credits.");
      return;
    }
    s.credits -= item.price;
    s.items[id]++;
    s.sounds.push(C.CUES.fabricate);
    return;
  }
  if (control === "use-item") {
    useItem(s, id);
    return;
  }
  if (control === "jettison") {
    if (s.satchel.coreSample) {
      s.satchel.coreSample = false;
      s.coreGround = cell(s);
    }
    return;
  }
  if (control === "fabricate") {
    const part = C.ROCKET_COMPONENTS[s.installed];
    if (
      !part ||
      s.credits < part.credits ||
      (part.material === "core-sample"
        ? !s.satchel.coreSample
        : part.material
          ? !s.satchel[part.material]
          : false)
    ) {
      note(s, "Component requirements not met.");
      return;
    }
    s.credits -= part.credits;
    if (part.material === "core-sample") {
      s.satchel.coreSample = false;
      s.coreTimer = null;
    } else if (part.material) s.satchel[part.material]--;
    s.installed++;
    s.sounds.push(C.CUES.fabricate);
    note(s, `${part.name} installed.`);
    return;
  }
  if (control === "launch") {
    if (s.installed === C.ROCKET_COMPONENTS.length) finish(s, null);
    return;
  }
  if (control === "save") {
    save(s);
    return;
  }
  if (control === "dismiss-notice") {
    s.notice = null;
    return;
  }
  if (control === "close-panel") {
    s.panel = null;
    return;
  }
  if (control === "inventory") {
    s.panel = s.panel === "inventory" ? null : "inventory";
    s.panelIndex = 0;
    return;
  }
  if (control === "pause") {
    s.screen = "paused";
    s.menuIndex = 0;
  }
}
export interface Held {
  left: boolean;
  right: boolean;
  down: boolean;
  up: boolean;
}
function breakTile(s: DeepcoreState, col: number, row: number) {
  const t = at(s, col, row),
    x = (col + 0.5) * C.TILE,
    y = (row + 0.5) * C.TILE;
  put(s, col, row, tile("tunnel", t.band));
  if (t.ore) {
    if (slots(s) < C.CARGO_TIERS[s.tiers.cargo - 1]) {
      s.ore[t.ore] = (s.ore[t.ore] ?? 0) + 1;
      s.sounds.push(C.CUES.orePickup);
      effect(s, "ore-sparkle", x, y);
    } else note(s, "Cargo full · mineral left behind");
  }
  if (t.material) {
    s.satchel[t.material]++;
    s.sounds.push(C.CUES.materialChime);
    effect(s, "material-shimmer", x, y);
    note(s, `${t.material.toUpperCase()} recovered`);
  }
  if (t.kind === "gas") gas(s, col, row);
  if (t.kind === "lava") {
    hurt(
      s,
      (t.band === "coreshell"
        ? C.LAVA_DRILL_CORESHELL
        : C.LAVA_DRILL_DEEPSTONE) *
        (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]),
      "lava",
    );
    s.sounds.push(C.CUES.lavaSizzle);
    effect(s, "lava-embers", x, y);
  }
}
function collides(s: ReadState, x: number, y: number) {
  for (
    let r = Math.floor(y / C.TILE);
    r <= Math.floor((y + C.MINER_H - 0.01) / C.TILE);
    r++
  )
    for (
      let c = Math.floor(x / C.TILE);
      c <= Math.floor((x + C.MINER_W - 0.01) / C.TILE);
      c++
    )
      if (
        at(s, c, r).kind !== "tunnel" &&
        y + C.MINER_H > solidTop(at(s, c, r), r) + 0.01
      )
        return true;
  return false;
}
export function step(s: DeepcoreState, h: Held, dt: number) {
  const m = s.miner,
    previousAnimation = m.state;
  s.elapsedSeconds += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.animTime += dt;
  s.noteTime = Math.max(0, s.noteTime - dt);
  s.shake = Math.max(0, s.shake - dt * 1.7);
  s.effects = s.effects
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 1.4);
  if (s.notice) {
    s.notice.age += dt;
    if (s.notice.age > C.NOTICE_DELAY + C.NOTICE_FADE) s.notice = null;
  }
  if (s.coreTimer !== null) {
    const old = s.coreTimer;
    s.coreTimer = Math.max(0, old - dt);
    const cadence = s.coreTimer < 15 ? 0.25 : s.coreTimer < 30 ? 0.5 : 1;
    if (Math.floor(old / cadence) !== Math.floor(s.coreTimer / cadence))
      s.sounds.push(C.CUES.alarmCore);
    if (s.coreTimer <= 0) {
      const p = s.coreGround ?? cell(s);
      effect(
        s,
        "core-detonation",
        (p.col + 0.5) * C.TILE,
        (p.row + 0.5) * C.TILE,
      );
      s.shake = 3;
      s.sounds.push(C.CUES.gasExplosion);
      const dist = Math.hypot(
        m.x + 28 - (p.col + 0.5) * C.TILE,
        m.y + 36 - (p.row + 0.5) * C.TILE,
      );
      if (s.satchel.coreSample || dist <= C.CORE_BLAST_TILES * C.TILE)
        finish(s, "core-detonation");
      s.satchel.coreSample = false;
      s.coreGround = null;
      s.coreTimer = null;
    }
  }
  if (s.screen !== "in-mine") return;
  if (!s.panel) {
    const onGround = grounded(s) || m.drilling?.dir === "down",
      thrust = h.up && m.fuel > 0,
      side = Number(h.right) - Number(h.left);
    if (side) m.facing = side > 0 ? "east" : "west";
    let target: DeepcoreState["miner"]["drilling"] = null;
    if (onGround && !thrust && m.drill && m.fuel >= C.DRILL_HIT_FUEL) {
      const c = Math.floor((m.x + 28) / C.TILE);
      const r =
        m.drilling?.dir === "down"
          ? m.drilling.row
          : Math.floor((m.y + C.MINER_H + 0.1) / C.TILE);
      if (h.down) target = { col: c, row: r, dir: "down" };
      else if (side) {
        const x = side > 0 ? m.x + C.MINER_W + 0.2 : m.x - 0.2;
        const col = Math.floor(x / C.TILE),
          row = Math.floor((m.y + C.MINER_H / 2) / C.TILE);
        if (
          Math.abs(
            (side > 0 ? m.x + C.MINER_W : m.x) -
              (side > 0 ? col * C.TILE : (col + 1) * C.TILE),
          ) < 0.5
        )
          target = { col, row, dir: side > 0 ? "right" : "left" };
      }
    }
    if (target) {
      const t = at(s, target.col, target.row);
      if (t.kind === "core" && target.dir === "down") {
        if (s.coreTimer === null) {
          s.satchel.coreSample = true;
          s.coreTimer = C.CORE_TIMER;
          effect(
            s,
            "core-extract",
            (target.col + 0.5) * C.TILE,
            target.row * C.TILE,
          );
          s.sounds.push(C.CUES.materialChime);
          note(s, "CORE SAMPLE · 90 seconds. Fly home.");
        }
        target = null;
      } else if (t.health === null) target = null;
    }
    if (
      !target ||
      !m.drilling ||
      target.col !== m.drilling.col ||
      target.row !== m.drilling.row
    )
      s.hitClock = 0;
    m.drilling = target;
    if (target) {
      s.hitClock += dt;
      while (
        s.hitClock + 1e-9 >= C.DRILL_HIT_INTERVAL &&
        m.fuel >= C.DRILL_HIT_FUEL
      ) {
        s.hitClock -= C.DRILL_HIT_INTERVAL;
        const t = at(s, target.col, target.row);
        if (t.health === null) break;
        m.fuel -= C.DRILL_HIT_FUEL;
        const health = t.health - C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1];
        put(s, target.col, target.row, {
          ...t,
          health,
          cutDown:
            t.cutDown ||
            (target.dir === "down" &&
              !["tunnel", "lava"].includes(
                at(s, target.col, target.row + 1).kind,
              )),
        });
        effect(
          s,
          "drill-debris",
          (target.col + 0.5) * C.TILE,
          target.row * C.TILE + 10,
        );
        if (health <= 0) {
          breakTile(s, target.col, target.row);
          if (
            target.dir === "down" &&
            m.travel &&
            at(s, target.col, target.row + 1).kind !== "tunnel" &&
            at(s, target.col, target.row + 1).kind !== "lava"
          )
            m.y = (target.row + 1) * C.TILE - C.MINER_H;
          m.drilling = null;
          s.hitClock = 0;
          break;
        }
      }
      if (target.dir === "down" && m.travel) {
        const t = at(s, target.col, target.row),
          below = at(s, target.col, target.row + 1);
        if (
          t.health !== null &&
          t.maxHealth &&
          below.kind !== "tunnel" &&
          below.kind !== "lava"
        )
          m.y =
            target.row * C.TILE -
            C.MINER_H +
            C.TILE * (1 - t.health / t.maxHealth);
      }
    }
    if (m.travel) {
      const fraction = load(s) / jet(s).liftLimitKg;
      m.vx = side * C.WALK_SPEED;
      if (thrust) {
        m.vy = Math.max(
          -jet(s).emptyClimb *
            (1 - (1 - C.CLIMB_CAP_FLOOR) * Math.min(1, fraction)),
          m.vy - jet(s).emptyAccel * Math.max(0, 1 - fraction) * dt,
        );
      } else if (!m.drilling || m.drilling.dir !== "down")
        m.vy = Math.min(
          C.FALL_TERMINAL_EMPTY +
            (C.FALL_TERMINAL_LOADED - C.FALL_TERMINAL_EMPTY) *
              Math.min(1, fraction),
          m.vy + C.GRAVITY * dt,
        );
      const nx = clamp(m.x + m.vx * dt, C.TILE, C.WORLD_W - C.TILE - C.MINER_W);
      if (!collides(s, nx, m.y)) m.x = nx;
      else {
        if (side > 0)
          m.x = Math.floor((nx + C.MINER_W) / C.TILE) * C.TILE - C.MINER_W;
        else if (side < 0) m.x = (Math.floor(nx / C.TILE) + 1) * C.TILE;
        m.vx = 0;
      }
      if (!m.drilling || m.drilling.dir !== "down") {
        const ny = m.y + m.vy * dt;
        if (!collides(s, m.x, ny)) m.y = ny;
        else if (m.vy >= 0) {
          const speed = m.vy;
          const row = Math.floor((ny + C.MINER_H) / C.TILE);
          const surfaces = [m.x + 1, m.x + C.MINER_W - 1]
            .map((x) => at(s, Math.floor(x / C.TILE), row))
            .filter((t) => t.kind !== "tunnel")
            .map((t) => solidTop(t, row));
          m.y = Math.min(...surfaces, row * C.TILE + C.TILE) - C.MINER_H;
          m.vy = 0;
          const damage =
            Math.max(0, speed - C.IMPACT_SAFE_SPEED) * C.IMPACT_DAMAGE_RATE;
          if (damage) {
            hurt(s, damage);
            effect(s, "impact-dust", m.x + 28, m.y + C.MINER_H);
            s.sounds.push(C.CUES.impact);
            s.shake = Math.min(1, damage / 20);
          }
        } else {
          m.y = (Math.floor(ny / C.TILE) + 1) * C.TILE;
          m.vy = 0;
        }
      }
    }
    let burn = m.y + C.MINER_H > C.SURFACE_Y ? C.LIFE_SUPPORT_BURN : 0;
    if (thrust) {
      burn +=
        (C.THRUST_BURN_MAX -
          (C.THRUST_BURN_MAX - C.THRUST_BURN_MIN) *
            clamp(-m.vy / C.CRUISE_SPEED, 0, 1)) *
        C.THRUST_BURN_SIZE_MULT[s.worldSize];
      if (
        Math.floor(s.elapsedSeconds * 15) !==
        Math.floor((s.elapsedSeconds - dt) * 15)
      )
        effect(s, "jetpack-exhaust", m.x + 12, m.y + 60);
    }
    if (side && !onGround) burn += C.AIR_BURN;
    m.fuel = Math.max(0, m.fuel - burn * dt);
    for (
      let r = Math.floor(m.y / C.TILE);
      r <= Math.floor((m.y + C.MINER_H) / C.TILE);
      r++
    )
      for (
        let c = Math.floor(m.x / C.TILE);
        c <= Math.floor((m.x + C.MINER_W) / C.TILE);
        c++
      ) {
        if (
          at(s, c, r).kind === "lava" &&
          !(m.drilling?.col === c && m.drilling.row === r)
        ) {
          hurt(
            s,
            C.LAVA_CONTACT_DPS *
              (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]) *
              dt,
            "lava",
          );
          if (
            Math.floor(s.elapsedSeconds * 5) !==
            Math.floor((s.elapsedSeconds - dt) * 5)
          ) {
            effect(s, "lava-embers", m.x + 28, m.y + 72);
            s.sounds.push(C.CUES.lavaSizzle);
          }
        }
      }
    m.state = m.drilling
      ? m.drilling.dir === "down"
        ? "drill-down"
        : "drill-side"
      : s.hurt > 0
        ? "hurt"
        : m.fuel <= 0
          ? "fuel-out"
          : thrust
            ? "jetpack"
            : !grounded(s)
              ? "fall"
              : side
                ? "walk"
                : "idle";
  }
  if (s.panel && s.hurt > 0) m.state = "hurt";
  if (m.state !== previousAnimation) s.animTime = 0;
  s.deepestDepthMeters = Math.max(s.deepestDepthMeters, depth(s));
  camera(s, dt);
  if (m.hull <= 0) finish(s, "hull-destroyed");
  else if (m.fuel <= 0 && m.y + C.MINER_H > C.SURFACE_Y + 0.01)
    finish(s, "fuel-out");
  if (
    Math.floor(s.elapsedSeconds / C.GAS_SEEP_PERIOD) !==
    Math.floor((s.elapsedSeconds - dt) / C.GAS_SEEP_PERIOD)
  ) {
    for (
      let r = Math.max(1, Math.floor(s.camera.y / C.TILE));
      r <= Math.min(s.coreRow, Math.ceil((s.camera.y + C.VIEW_H) / C.TILE));
      r++
    )
      for (
        let c = Math.floor(s.camera.x / C.TILE);
        c <= Math.ceil((s.camera.x + C.VIEW_W) / C.TILE);
        c++
      )
        if (at(s, c, r).kind === "gas")
          effect(s, "gas-seep", (c + 0.5) * C.TILE, (r + 0.5) * C.TILE);
  }
}
export function advance(state: ReadState, h: Held, dt: number) {
  const s = copy(state);
  s.accumulator += dt;
  while (s.accumulator + 1e-9 >= 1 / 120) {
    step(s, h, 1 / 120);
    s.accumulator -= 1 / 120;
    if (s.screen !== "in-mine") break;
  }
  return s;
}
