import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
export interface Tile {
  kind: C.TileKind;
  band: C.BandName | null;
  ore: C.OreId | null;
  material: C.MaterialId | null;
  health: number | null;
  maxHealth: number | null;
  /** The cleared upper portion of an interrupted downward cut. */
  cutDown?: boolean;
}
export interface Point {
  col: number;
  row: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Assets {
  images: Record<string, ImageBitmap>;
  fx: Record<string, ParticleSystem>;
}
export interface Effect {
  name: string;
  x: number;
  y: number;
  age: number;
  seed: number;
}
export interface DeepcoreState {
  assets: Assets;
  screen: C.ScreenName;
  panel: C.PanelId | null;
  mode: C.Mode;
  worldSize: C.WorldSize;
  coreRow: number;
  menuIndex: number;
  muted: boolean;
  simTime: number;
  elapsedSeconds: number;
  hasSave: boolean;
  credits: number;
  creditsEarned: number;
  deepestDepthMeters: number;
  coreTimer: number | null;
  coreGround: Point | null;
  camera: { x: number; y: number; lead: number };
  miner: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: C.Facing;
    state: C.MinerState;
    travel: boolean;
    drill: boolean;
    fuel: number;
    hull: number;
    drilling: (Point & { dir: "down" | "left" | "right" }) | null;
  };
  ore: Partial<Record<C.OreId, number>>;
  satchel: { resonite: number; cryenite: number; coreSample: boolean };
  tiers: Record<C.TrackName, number>;
  items: Record<C.ItemId, number>;
  installed: number;
  nextTeleportHeight: number | null;
  nextTeleportSpeed: number | null;
  notice: { hazard: C.NoticeHazard; age: number } | null;
  noticesFired: Record<C.NoticeHazard, boolean>;
  summary: {
    deepestDepthMeters: number;
    creditsEarned: number;
    elapsedSeconds: number;
    mode: C.Mode;
    componentsInstalled: number;
    deathCause: C.DeathCause | null;
  } | null;
  mine: Tile[];
  hitClock: number;
  accumulator: number;
  hurt: number;
  animTime: number;
  shake: number;
  effects: Effect[];
  sounds: string[];
  note: string;
  noteTime: number;
  panelIndex: number;
  pointerDown: string | null;
  launchTime: number;
}
export type ReadState = DeepReadonly<DeepcoreState>;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export const bandAt = (row: number, coreRow: number) =>
  C.BANDS[Math.min(3, Math.floor((4 * (row - 1)) / (coreRow - 1)))];
export function tile(
  kind: C.TileKind,
  band: C.BandName | null = null,
  ore: C.OreId | null = null,
  material: C.MaterialId | null = null,
): Tile {
  const health =
    band && ["rock", "ore", "gas", "lava", "material"].includes(kind)
      ? C.BAND_HEALTH[band]
      : null;
  return { kind, band, ore, material, health, maxHealth: health };
}
export function at(s: ReadState, col: number, row: number): Tile {
  if (col < 0 || col >= C.WORLD_COLS || row > s.coreRow) return tile("bedrock");
  if (row <= 0 && col >= 1 && col <= 30) return tile("tunnel");
  return (s.mine[row * C.WORLD_COLS + col] as Tile) ?? tile("bedrock");
}
export function put(s: DeepcoreState, col: number, row: number, t: Tile) {
  s.mine[row * C.WORLD_COLS + col] = t;
}
export function emptyMine(coreRow: number): Tile[] {
  return Array.from({ length: (coreRow + 1) * C.WORLD_COLS }, (_, i) => {
    const c = i % C.WORLD_COLS,
      r = Math.floor(i / C.WORLD_COLS);
    return tile(
      r === coreRow
        ? c === C.CORE_COL
          ? "core"
          : "bedrock"
        : c === 0 || c === 31
          ? "bedrock"
          : "tunnel",
      r > 0 && r < coreRow ? bandAt(r, coreRow) : null,
    );
  });
}
export function fresh(assets: Assets, hasSave = false): DeepcoreState {
  return {
    assets,
    screen: "title",
    panel: null,
    mode: "standard",
    worldSize: "standard",
    coreRow: C.STANDARD_ROWS,
    menuIndex: 0,
    muted: false,
    simTime: 0,
    elapsedSeconds: 0,
    hasSave,
    credits: 0,
    creditsEarned: 0,
    deepestDepthMeters: 0,
    coreTimer: null,
    coreGround: null,
    camera: { x: 0, y: 0, lead: 0 },
    miner: {
      x: C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2,
      y: C.SURFACE_Y - C.MINER_H,
      vx: 0,
      vy: 0,
      facing: "east",
      state: "idle",
      travel: true,
      drill: true,
      fuel: C.FUEL_TIERS[0],
      hull: C.HULL_TIERS[0],
      drilling: null,
    },
    ore: {},
    satchel: { resonite: 0, cryenite: 0, coreSample: false },
    tiers: Object.fromEntries(C.TRACKS.map((t) => [t, 1])) as Record<
      C.TrackName,
      number
    >,
    items: Object.fromEntries(C.ITEM_IDS.map((t) => [t, 0])) as Record<
      C.ItemId,
      number
    >,
    installed: 0,
    nextTeleportHeight: null,
    nextTeleportSpeed: null,
    notice: null,
    noticesFired: { gas: false, lava: false },
    summary: null,
    mine: emptyMine(C.STANDARD_ROWS),
    hitClock: 0,
    accumulator: 0,
    hurt: 0,
    animTime: 0,
    shake: 0,
    effects: [],
    sounds: [],
    note: "",
    noteTime: 0,
    panelIndex: 0,
    pointerDown: null,
    launchTime: 0,
  };
}
export function copy(s: ReadState): DeepcoreState {
  return {
    ...s,
    assets: s.assets as Assets,
    mine: s.mine.slice() as Tile[],
    camera: { ...s.camera },
    miner: {
      ...s.miner,
      drilling: s.miner.drilling ? { ...s.miner.drilling } : null,
    },
    ore: { ...s.ore },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    notice: s.notice ? { ...s.notice } : null,
    noticesFired: { ...s.noticesFired },
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    summary: s.summary ? { ...s.summary } : null,
    effects: s.effects.map((e) => ({ ...e })),
    sounds: [...s.sounds],
  };
}
export const cell = (s: ReadState): Point => ({
  col: Math.floor((s.miner.x + C.MINER_W / 2) / C.TILE),
  row: Math.floor((s.miner.y + C.MINER_H / 2) / C.TILE),
});
export const maxFuel = (s: ReadState) => C.FUEL_TIERS[s.tiers.fuel - 1];
export const maxHull = (s: ReadState) => C.HULL_TIERS[s.tiers.hull - 1];
export const slots = (s: ReadState) =>
  Object.values(s.ore).reduce((a, n) => a + (n ?? 0), 0);
export const load = (s: ReadState) =>
  C.MINERALS.reduce((a, m) => a + (s.ore[m.id] ?? 0) * m.weightKg, 0);
export const jet = (s: ReadState) => C.JETPACK_TIERS[s.tiers.jetpack - 1];
export const depth = (s: ReadState) =>
  Math.max(
    0,
    ((s.miner.y + C.MINER_H - C.SURFACE_Y) / C.TILE) * C.METERS_PER_ROW,
  );
export function solidTop(t: Tile, row: number) {
  return (
    row * C.TILE +
    (t.cutDown && t.health !== null && t.maxHealth
      ? C.TILE * (1 - t.health / t.maxHealth)
      : 0)
  );
}
export function grounded(s: ReadState) {
  const m = s.miner,
    row = Math.floor((m.y + C.MINER_H + 0.1) / C.TILE);
  return [m.x + 1, m.x + C.MINER_W - 1].some((x) => {
    const t = at(s, Math.floor(x / C.TILE), row);
    return (
      t.kind !== "tunnel" && Math.abs(m.y + C.MINER_H - solidTop(t, row)) < 0.5
    );
  });
}
export const buildings = C.BUILDINGS.map((id, i) => ({
  id,
  x: 100 + i * 310,
  y: C.SURFACE_Y - 120,
  w: 200,
  h: 120,
}));
export function effect(s: DeepcoreState, name: string, x: number, y: number) {
  s.effects.push({ name, x, y, age: 0, seed: Math.floor(Math.random() * 1e8) });
}
export function note(s: DeepcoreState, text: string) {
  s.note = text;
  s.noteTime = 3;
}
export function camera(s: DeepcoreState, dt: number) {
  const target =
    Math.abs(s.miner.vy) <= C.CAM_STILL_SPEED
      ? 0
      : Math.sign(s.miner.vy) * C.CAM_LEAD_MAX;
  const rate =
    (C.CAM_LEAD_MAX / C.CAM_LEAD_RAMP) *
    (s.camera.lead * target <= 0 || Math.abs(target) < Math.abs(s.camera.lead)
      ? C.CAM_UNWIND_MULT
      : 1);
  s.camera.lead += clamp(target - s.camera.lead, -rate * dt, rate * dt);
  s.camera.x = clamp(
    s.miner.x + C.MINER_W / 2 - C.VIEW_W / 2,
    0,
    C.WORLD_W - C.VIEW_W,
  );
  s.camera.y = Math.min(
    s.miner.y + C.MINER_H / 2 - C.VIEW_H / 2 + s.camera.lead,
    (s.coreRow + 1) * C.TILE - C.VIEW_H,
  );
}
/** Quotas keep each stratum's resources stable even in a Quick expedition.
 * Protected shafts and crosscuts guarantee a route to both nodes and the Core.
 */
export function generate(s: DeepcoreState) {
  s.mine = emptyMine(s.coreRow);
  for (let r = 1; r < s.coreRow; r++)
    for (let c = 1; c < 31; c++)
      put(s, c, r, tile("rock", bandAt(r, s.coreRow)));
  const protectedCell = (c: number, r: number) =>
    c === C.CAVE_MOUTH_COL || c === C.CORE_COL || r === s.coreRow - 1;
  const shuffle = <T>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  for (const [bi, band] of C.BANDS.entries()) {
    const cells: Point[] = [];
    for (let r = 1; r < s.coreRow; r++)
      if (bandAt(r, s.coreRow) === band)
        for (let c = 1; c < 31; c++) cells.push({ col: c, row: r });
    const average =
      cells.reduce((sum, p) => sum + (p.row - 1) / (s.coreRow - 1), 0) /
      cells.length;
    const mineral = (r: number) => {
      const f = (r - 1) / (s.coreRow - 1),
        ws = C.MINERALS.map(
          (m) => m.pick * Math.max(0, 1 - Math.abs(f - m.peak) / m.spread),
        );
      let n = Math.random() * ws.reduce((a, b) => a + b, 0),
        i = 0;
      while (i < ws.length - 1 && (n -= ws[i]) > 0) i++;
      return C.MINERALS[i].id;
    };
    let oreLeft = Math.round(
      cells.filter((p) => p.row >= C.ORE_MIN_ROW).length * C.ORE_DENSITY,
    );
    for (const p of shuffle([...cells])) {
      if (!oreLeft) break;
      if (p.row < C.ORE_MIN_ROW || at(s, p.col, p.row).kind !== "rock")
        continue;
      const ore = mineral(p.row),
        length = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < length && oreLeft; i++) {
        const col = p.col + i,
          row = p.row;
        if (col > 30 || at(s, col, row).kind !== "rock") break;
        put(s, col, row, tile("ore", band, ore));
        oreLeft--;
      }
    }
    const fill = (kind: "stone" | "gas" | "lava", density: number) => {
      let remaining = Math.round(cells.length * density);
      for (const p of shuffle(
        cells.filter((p) => !protectedCell(p.col, p.row)),
      )) {
        if (!remaining) break;
        if (at(s, p.col, p.row).kind !== "rock") continue;
        const cluster =
          kind === "lava"
            ? [
                { col: p.col, row: p.row },
                { col: p.col + 1, row: p.row },
                { col: p.col, row: p.row + 1 },
                { col: p.col + 1, row: p.row + 1 },
              ]
            : [p];
        for (const q of cluster) {
          if (!remaining) break;
          if (
            q.col < 31 &&
            q.row < s.coreRow &&
            bandAt(q.row, s.coreRow) === band &&
            !protectedCell(q.col, q.row) &&
            at(s, q.col, q.row).kind === "rock"
          ) {
            put(s, q.col, q.row, tile(kind, band));
            remaining--;
          }
        }
      }
    };
    if (bi > 0) {
      const f = (average - 0.25) / 0.75;
      fill(
        "stone",
        C.STONE_DENSITY_MIN + (C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * f,
      );
      fill(
        "gas",
        C.GAS_DENSITY_MIN + (C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * f,
      );
    }
    if (bi > 1)
      fill(
        "lava",
        C.LAVA_DENSITY_MIN +
          ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (average - 0.5)) / 0.5,
      );
  }
  for (const [i, material] of C.MATERIALS.entries()) {
    const r =
        Math.floor((0.25 * (i + 1) + Math.random() * 0.24) * (s.coreRow - 1)) +
        1,
      c = 1 + Math.floor(Math.random() * 30);
    put(s, c, r, tile("material", bandAt(r, s.coreRow), null, material));
    for (
      let x = Math.min(c, C.CAVE_MOUTH_COL);
      x <= Math.max(c, C.CAVE_MOUTH_COL);
      x++
    )
      if (["lava", "stone"].includes(at(s, x, r).kind))
        put(s, x, r, tile("rock", bandAt(r, s.coreRow)));
  }
  put(s, C.CAVE_MOUTH_COL, 1, tile("tunnel", "topsoil"));
}
export function scanner(s: ReadState) {
  let result: {
    locked: boolean;
    target: C.MaterialId | null;
    dirX: number;
    dirY: number;
    distanceTiles: number | null;
  } = { locked: false, target: null, dirX: 0, dirY: 0, distanceTiles: null };
  const range = C.SCANNER_TIERS[s.tiers.scanner - 1];
  if (!range) return result;
  const p = cell(s);
  for (let i = 0; i < s.mine.length; i++) {
    const t = s.mine[i];
    if (t.material && s.satchel[t.material] === 0) {
      const dx = (i % 32) - p.col,
        dy = Math.floor(i / 32) - p.row,
        d = Math.hypot(dx, dy);
      if (
        d <= range &&
        (result.distanceTiles === null || d < result.distanceTiles)
      )
        result = {
          locked: true,
          target: t.material,
          dirX: d ? dx / d : 0,
          dirY: d ? dy / d : 0,
          distanceTiles: d,
        };
    }
  }
  return result;
}
