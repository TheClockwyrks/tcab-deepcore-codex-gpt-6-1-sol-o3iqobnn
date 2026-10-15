import * as C from "./constants";
import {
  at,
  put,
  tile,
  copy,
  fresh,
  emptyMine,
  generate,
  cell,
  grounded,
  depth,
  slots,
  load,
  jet,
  maxFuel,
  maxHull,
  scanner,
  buildings,
  type ReadState,
  type DeepcoreState,
} from "./model";
import { readSave, clearSave, transact } from "./simulation";
import { menu, menuRect, controlRect } from "./interface";
function valid(
  value: boolean,
  message = "Invalid debug argument",
): asserts value {
  if (!value) throw new RangeError(message);
}
function num(n: number, min = -Infinity, max = Infinity) {
  valid(Number.isFinite(n) && n >= min && n <= max);
}
function member<T extends string>(
  n: string,
  list: readonly T[],
): asserts n is T {
  valid(list.includes(n as T));
}
function coordinate(s: ReadState, c: number, r: number) {
  valid(
    Number.isInteger(c) &&
      Number.isInteger(r) &&
      c >= 0 &&
      c < 32 &&
      r >= 1 &&
      r <= s.coreRow,
  );
}
function mutate(s: ReadState, fn: (n: DeepcoreState) => void) {
  const n = copy(s);
  fn(n);
  return n;
}
export function snapshot(s: ReadState) {
  const p = cell(s);
  return {
    version: C.DEEPCORE_DEBUG_VERSION,
    screen: s.screen,
    panel: s.panel,
    mode: s.mode,
    worldSize: s.worldSize,
    coreRow: s.coreRow,
    menuIndex: s.menuIndex,
    muted: s.muted,
    simTime: s.simTime,
    elapsedSeconds: s.elapsedSeconds,
    hasSave: s.hasSave,
    credits: s.credits,
    creditsEarned: s.creditsEarned,
    depthMeters: depth(s),
    deepestDepthMeters: s.deepestDepthMeters,
    coreTimer: s.coreTimer,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    camera: { ...s.camera },
    miner: {
      ...s.miner,
      ...p,
      grounded: grounded(s),
      maxFuel: maxFuel(s),
      maxHull: maxHull(s),
      overloaded: load(s) >= jet(s).liftLimitKg,
      drilling: s.miner.drilling
        ? {
            ...s.miner.drilling,
            progress:
              1 -
              (at(s, s.miner.drilling.col, s.miner.drilling.row).health ?? 0) /
                (at(s, s.miner.drilling.col, s.miner.drilling.row).maxHealth ??
                  1),
          }
        : null,
    },
    cargo: {
      slotsUsed: slots(s),
      slotCap: C.CARGO_TIERS[s.tiers.cargo - 1],
      loadKg: load(s),
      liftLimitKg: jet(s).liftLimitKg,
      ore: { ...s.ore },
    },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    nextTeleportHeight: s.nextTeleportHeight,
    nextTeleportSpeed: s.nextTeleportSpeed,
    rocket: {
      installed: C.ROCKET_COMPONENT_IDS.slice(0, s.installed),
      nextComponent: C.ROCKET_COMPONENT_IDS[s.installed] ?? null,
    },
    scanner: scanner(s),
    notice: s.notice
      ? { hazard: s.notice.hazard, shown: s.notice.age >= C.NOTICE_DELAY }
      : null,
    noticesFired: { ...s.noticesFired },
    summary: s.summary ? { ...s.summary } : null,
  };
}
const control =
  (id: string) =>
  (s: ReadState, subject: string | null = null) =>
    mutate(s, (n) => transact(n, id, subject));
export const debug = {
  version: C.DEEPCORE_DEBUG_VERSION,
  snapshot,
  tileAt: (s: ReadState, c: number, r: number) => {
    const t =
      c < 0 || c >= C.WORLD_COLS || r < 1 || r > s.coreRow
        ? tile("bedrock")
        : at(s, c, r);
    return {
      kind: t.kind,
      band: t.band,
      ore: t.ore,
      material: t.material,
      health: t.health,
      maxHealth: t.maxHealth,
    };
  },
  findTile: (s: ReadState, kind: C.TileKind) => {
    member(kind, C.TILE_KINDS);
    const p = cell(s);
    let best: { col: number; row: number } | null = null,
      d = Infinity;
    s.mine.forEach((t, i) => {
      if (i >= C.WORLD_COLS && t.kind === kind) {
        const col = i % 32,
          row = Math.floor(i / 32),
          dd = Math.hypot(col - p.col, row - p.row);
        if (dd < d) {
          d = dd;
          best = { col, row };
        }
      }
    });
    return best;
  },
  buildings: (_s: ReadState) => buildings.map((b) => ({ ...b })),
  menuItemRect: menuRect,
  controlRect,
  reset: (s: ReadState) => ({
    ...fresh(s.assets as DeepcoreState["assets"], s.hasSave),
    muted: s.muted,
  }),
  reconcile: (s: ReadState) => copy(s),
  clearMine: (s: ReadState) =>
    mutate(s, (n) => {
      n.mine = emptyMine(n.coreRow);
    }),
  generateMine: (s: ReadState) => mutate(s, generate),
  setTile: (s: ReadState, c: number, r: number, kind: C.TileKind) =>
    mutate(s, (n) => {
      coordinate(s, c, r);
      member(
        kind,
        C.TILE_KINDS.filter((t) => t !== "ore" && t !== "material"),
      );
      put(
        n,
        c,
        r,
        tile(
          kind,
          at(s, c, r).band ??
            C.BANDS[Math.min(3, Math.floor((4 * (r - 1)) / (s.coreRow - 1)))],
        ),
      );
    }),
  setOreTile: (s: ReadState, c: number, r: number, ore: C.OreId) =>
    mutate(s, (n) => {
      coordinate(s, c, r);
      member(
        ore,
        C.MINERALS.map((m) => m.id),
      );
      put(n, c, r, tile("ore", at(s, c, r).band ?? "topsoil", ore));
    }),
  setMaterialTile: (
    s: ReadState,
    c: number,
    r: number,
    material: C.MaterialId,
  ) =>
    mutate(s, (n) => {
      coordinate(s, c, r);
      member(material, C.MATERIALS);
      put(
        n,
        c,
        r,
        tile("material", at(s, c, r).band ?? "topsoil", null, material),
      );
    }),
  setTileHealth: (s: ReadState, c: number, r: number, health: number) =>
    mutate(s, (n) => {
      coordinate(s, c, r);
      const t = at(s, c, r);
      valid(t.maxHealth !== null);
      num(health, Number.MIN_VALUE, t.maxHealth);
      put(n, c, r, { ...t, health });
    }),
  placeCoreSample: (s: ReadState, c: number, r: number) =>
    mutate(s, (n) => {
      coordinate(s, c, r);
      valid(at(s, c, r).kind === "tunnel" && s.coreTimer === null);
      n.coreGround = { col: c, row: r };
      n.coreTimer = C.CORE_TIMER;
    }),
  setMinerPosition: (s: ReadState, x: number, y: number) =>
    mutate(s, (n) => {
      num(x);
      num(y);
      n.miner.x = x;
      n.miner.y = y;
    }),
  setMinerVelocity: (s: ReadState, vx: number, vy: number) =>
    mutate(s, (n) => {
      num(vx);
      num(vy);
      n.miner.vx = vx;
      n.miner.vy = vy;
    }),
  setFacing: (s: ReadState, facing: C.Facing) =>
    mutate(s, (n) => {
      member(facing, C.FACINGS);
      n.miner.facing = facing;
    }),
  setFuel: (s: ReadState, value: number) =>
    mutate(s, (n) => {
      num(value, 0);
      n.miner.fuel = value;
    }),
  setHull: (s: ReadState, value: number) =>
    mutate(s, (n) => {
      num(value, 0);
      n.miner.hull = value;
    }),
  setMinerTravel: (s: ReadState, enabled: boolean) =>
    mutate(s, (n) => {
      valid(typeof enabled === "boolean");
      n.miner.travel = enabled;
    }),
  setMinerDrill: (s: ReadState, enabled: boolean) =>
    mutate(s, (n) => {
      valid(typeof enabled === "boolean");
      n.miner.drill = enabled;
    }),
  setScreen: (s: ReadState, screen: C.ScreenName) =>
    mutate(s, (n) => {
      member(screen, C.SCREENS);
      n.screen = screen;
      n.menuIndex = 0;
    }),
  setPanel: (s: ReadState, panel: C.PanelId | null) =>
    mutate(s, (n) => {
      if (panel !== null) member(panel, C.PANELS);
      n.panel = panel;
      n.panelIndex = 0;
    }),
  setMenuIndex: (s: ReadState, index: number) =>
    mutate(s, (n) => {
      num(index, 0, menu(s).length - 1);
      valid(Number.isInteger(index));
      n.menuIndex = index;
    }),
  setMode: (s: ReadState, mode: C.Mode) =>
    mutate(s, (n) => {
      member(mode, C.MODES);
      n.mode = mode;
    }),
  setWorldSize: (s: ReadState, size: C.WorldSize) =>
    mutate(s, (n) => {
      member(size, C.WORLD_SIZES);
      n.worldSize = size;
      n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[size]);
      n.mine = emptyMine(n.coreRow);
      for (let r = 1; r < Math.min(s.coreRow, n.coreRow); r++)
        for (let c = 0; c < 32; c++) put(n, c, r, { ...at(s, c, r) });
    }),
  setCredits: (s: ReadState, v: number) =>
    mutate(s, (n) => {
      num(v, 0);
      n.credits = v;
    }),
  setTier: (s: ReadState, track: C.TrackName, tier: number) =>
    mutate(s, (n) => {
      member(track, C.TRACKS);
      num(tier, 1, C.MAX_TIER[track]);
      valid(Number.isInteger(tier));
      n.tiers[track] = tier;
      n.miner.fuel = Math.min(n.miner.fuel, maxFuel(n));
      n.miner.hull = Math.min(n.miner.hull, maxHull(n));
    }),
  setCargo: (s: ReadState, ore: C.OreId, count: number) =>
    mutate(s, (n) => {
      member(
        ore,
        C.MINERALS.map((m) => m.id),
      );
      num(count, 0);
      valid(Number.isInteger(count));
      if (count) n.ore[ore] = count;
      else delete n.ore[ore];
    }),
  setMaterial: (s: ReadState, material: C.MaterialId, count: number) =>
    mutate(s, (n) => {
      member(material, C.MATERIALS);
      num(count, 0);
      valid(Number.isInteger(count));
      n.satchel[material] = count;
    }),
  setCoreCarried: (s: ReadState, carried: boolean) =>
    mutate(s, (n) => {
      valid(typeof carried === "boolean");
      if (carried) valid(s.coreTimer === null);
      if (carried) {
        n.satchel.coreSample = true;
        n.coreTimer = C.CORE_TIMER;
      } else if (n.satchel.coreSample) {
        n.satchel.coreSample = false;
        n.coreTimer = null;
      }
    }),
  setCoreTimer: (s: ReadState, v: number) =>
    mutate(s, (n) => {
      valid(s.coreTimer !== null);
      num(v, Number.MIN_VALUE);
      n.coreTimer = v;
    }),
  setItemCount: (s: ReadState, item: C.ItemId, count: number) =>
    mutate(s, (n) => {
      member(item, C.ITEM_IDS);
      num(count, 0);
      valid(Number.isInteger(count));
      n.items[item] = count;
    }),
  setRocketInstalled: (s: ReadState, count: number) =>
    mutate(s, (n) => {
      num(count, 0, C.ROCKET_COMPONENT_IDS.length);
      valid(Number.isInteger(count));
      n.installed = count;
    }),
  setNoticeFired: (s: ReadState, hazard: C.NoticeHazard, fired: boolean) =>
    mutate(s, (n) => {
      member(hazard, C.NOTICE_HAZARDS);
      valid(typeof fired === "boolean");
      n.noticesFired[hazard] = fired;
    }),
  setCameraLead: (s: ReadState, v: number) =>
    mutate(s, (n) => {
      num(v, -C.CAM_LEAD_MAX, C.CAM_LEAD_MAX);
      n.camera.lead = v;
    }),
  setElapsed: (s: ReadState, v: number) =>
    mutate(s, (n) => {
      num(v, 0);
      n.elapsedSeconds = v;
    }),
  clearSave: (s: ReadState) => mutate(s, clearSave),
  setNextTeleportHeight: (s: ReadState, v: number | null) =>
    mutate(s, (n) => {
      if (v !== null)
        num(v, C.TELEPORT_HEIGHT_TILES_MIN, C.TELEPORT_HEIGHT_TILES_MAX);
      n.nextTeleportHeight = v;
    }),
  setNextTeleportSpeed: (s: ReadState, v: number | null) =>
    mutate(s, (n) => {
      if (v !== null) num(v, C.TELEPORT_SPEED_MIN, C.TELEPORT_SPEED_MAX);
      n.nextTeleportSpeed = v;
    }),
  dropOre: (s: ReadState, ore: C.OreId) => {
    member(
      ore,
      C.MINERALS.map((m) => m.id),
    );
    return control("drop-ore")(s, ore);
  },
  sell: control("sell"),
  buyFuel: control("buy-fuel"),
  fillFuel: control("fill-fuel"),
  buyRepair: control("buy-repair"),
  repairFull: control("repair-full"),
  buyUpgrade: (s: ReadState, t: C.TrackName) => {
    member(t, C.TRACKS);
    return control("buy-upgrade")(s, t);
  },
  buyItem: (s: ReadState, t: C.ItemId) => {
    member(t, C.ITEM_IDS);
    return control("buy-item")(s, t);
  },
  useItem: (s: ReadState, t: C.ItemId) => {
    member(t, C.ITEM_IDS);
    return control("use-item")(s, t);
  },
  jettison: control("jettison"),
  fabricate: control("fabricate"),
  launch: control("launch"),
  save: control("save"),
  dismissNotice: control("dismiss-notice"),
};
export type DeepcoreDebugApi = typeof debug;
export const initialSave = () => readSave() !== null;
