import { describe, it, expect, vi, afterEach } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { InitApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  fresh,
  copy,
  at,
  emptyMine,
  put,
  tile,
  depth,
  load,
  grounded,
  scanner,
  type DeepcoreState,
} from "./model";
import { debug } from "./debug";
import { advance, start, transact, finish, gas } from "./simulation";
import { menu, choose, controlRect } from "./interface";
import { game } from "./game";
vi.mock("./assets", () => ({
  loadAssets: async (api: InitApi<DeepcoreState>) => {
    for (const cue of Object.values(C.CUES))
      api.audio.define(cue, { freq: 100, durationMs: 50 });
    return { images: {}, fx: {} };
  },
}));
const idle = { left: false, right: false, down: false, up: false };
function state() {
  const s = fresh({ images: {}, fx: {} });
  s.screen = "in-mine";
  s.mine = emptyMine(s.coreRow);
  return s;
}
afterEach(() => vi.unstubAllGlobals());
describe("immutable fixed timestep simulation", () => {
  it("drills the specified cadence and preserves the input state", () => {
    let s = state();
    put(s, 4, 1, tile("ore", "topsoil", "ferron"));
    put(s, 4, 2, tile("rock", "topsoil"));
    const before = JSON.stringify(s);
    const n = advance(s, { ...idle, down: true }, 0.5);
    expect(at(n, 4, 1).kind).toBe("tunnel");
    expect(n.ore.ferron).toBe(1);
    expect(n.miner.fuel).toBeCloseTo(99 - 0.4 * 0.5, 1);
    expect(JSON.stringify(s)).toBe(before);
    s = debug.setTile(s, 4, 1, "stone");
    expect(at(advance(s, { ...idle, down: true }, 1), 4, 1).kind).toBe("stone");
  });
  it("partial damage persists and a gated drill spends no hit fuel", () => {
    let s = state();
    put(s, 4, 1, tile("rock", "topsoil"));
    s = advance(s, { ...idle, down: true }, 0.25);
    expect(at(s, 4, 1).health).toBe(2);
    const held = debug.setMinerDrill(s, false);
    expect(at(advance(held, { ...idle, down: true }, 1), 4, 1).health).toBe(2);
  });
  it("integrates the same fall under uneven frame partitions", () => {
    let a = state(),
      b = copy(a);
    for (let i = 0; i < 120; i++) a = advance(a, idle, 1 / 120);
    for (let i = 0; i < 10; i++) {
      b = advance(b, idle, 0.033);
      b = advance(b, idle, 0.067);
    }
    expect(a.miner.y).toBeCloseTo(b.miner.y, 7);
    expect(a.miner.fuel).toBeCloseTo(b.miner.fuel, 7);
  });
  it("applies load, overload and shedding a unit", () => {
    let s = state();
    s = debug.setCargo(s, "adamite", 5);
    expect(load(s)).toBe(420);
    const n = advance(s, { ...idle, up: true }, 0.5);
    expect(n.miner.vy).toBe(0);
    expect(debug.snapshot(n).miner.overloaded).toBe(true);
    s = debug.dropOre(n, "adamite");
    expect(load(s)).toBe(336);
    expect(advance(s, { ...idle, up: true }, 0.5).miner.vy).toBeLessThan(0);
  });
  it("holds velocity and position with travel gated while life support continues", () => {
    let s = state();
    s = debug.setMinerPosition(s, 320, 1000);
    s = debug.setMinerVelocity(s, 33, 100);
    s = debug.setMinerTravel(s, false);
    const n = advance(s, idle, 2);
    expect(n.miner.y).toBe(1000);
    expect(n.miner.vy).toBe(100);
    expect(n.miner.fuel).toBeCloseTo(99.2);
  });
  it("takes impact damage and stops on solid ground", () => {
    let s = state();
    put(s, 4, 10, tile("rock", "topsoil"));
    s = debug.setMinerPosition(s, 332, 600);
    s = debug.setMinerVelocity(s, 0, 900);
    const n = advance(s, idle, 0.4);
    expect(grounded(n)).toBe(true);
    expect(n.miner.hull).toBeLessThan(100);
    expect(n.miner.y + 72).toBe(800);
  });
  it("respects no ceiling and the camera follows above camp", () => {
    const s = advance(state(), { ...idle, up: true }, 1);
    expect(s.miner.y).toBeLessThan(-300);
    expect(s.camera.y).toBeLessThan(-500);
    expect(s.miner.fuel).toBeLessThan(100);
  });
});
describe("interrupted cuts", () => {
  it("can thrust out of a partially cut floor without clipping downward", () => {
    let s = state();
    put(s, 4, 1, tile("rock", "topsoil"));
    put(s, 4, 2, tile("rock", "topsoil"));
    s = advance(s, { ...idle, down: true }, 0.25);
    const sunk = s.miner.y;
    expect(sunk).toBeGreaterThan(8);
    expect(grounded(s)).toBe(true);
    s = advance(s, { ...idle, up: true }, 0.2);
    expect(s.miner.y).toBeLessThan(sunk);
    expect(at(s, 4, 1).health).toBe(2);
  });
});
describe("hazards and field supplies", () => {
  it("gas is location aware, causes hurt and arms a delayed notice", () => {
    const s = state();
    s.miner.y = 126 * 80 - 72;
    gas(s, 4, 126);
    expect(s.miner.hull).toBeLessThan(100);
    expect(s.noticesFired.gas).toBe(true);
    expect(debug.snapshot(s).notice?.shown).toBe(false);
    expect(s.effects[0].name).toBe("gas-explosion");
  });
  it("a jettisoned Sample preserves its time and spares a distant miner", () => {
    let s = state();
    s = debug.setCoreCarried(s, true);
    s = debug.setCoreTimer(s, 0.5);
    s = debug.jettison(s);
    expect(s.coreTimer).toBe(0.5);
    s = debug.setMinerPosition(s, 1600, 8);
    const n = advance(s, idle, 1);
    expect(n.screen).toBe("in-mine");
    expect(n.coreTimer).toBeNull();
  });
  it("a carried Sample detonation ends the expedition irreversibly", () => {
    let s = debug.setCoreCarried(state(), true);
    s = debug.setCoreTimer(s, 0.1);
    s = advance(s, idle, 0.2);
    expect(s.screen).toBe("game-over");
    expect(s.summary?.deathCause).toBe("core-detonation");
    expect(s.coreTimer).toBeNull();
  });
  it("explosives clear boulders without collecting ore or removing materials", () => {
    const s = state();
    s.items.dynamite = 1;
    put(s, 4, 1, tile("stone", "topsoil"));
    put(s, 3, 1, tile("ore", "topsoil", "ferron"));
    put(s, 5, 1, tile("material", "rockbed", null, "resonite"));
    transact(s, "use-item", "dynamite");
    expect(at(s, 4, 1).kind).toBe("tunnel");
    expect(at(s, 3, 1).kind).toBe("tunnel");
    expect(at(s, 5, 1).kind).toBe("material");
    expect(s.ore).toEqual({});
    expect(s.items.dynamite).toBe(0);
  });
  it("consumes both teleport poses and no unused supplies", () => {
    let s = state();
    s.items["quantum-teleporter"] = 1;
    s = debug.setNextTeleportHeight(s, 4);
    s = debug.setNextTeleportSpeed(s, 300);
    s = debug.useItem(s, "quantum-teleporter");
    expect(s.miner.y + 72).toBe(80 - 4 * 80);
    expect(s.miner.vy).toBe(300);
    expect(s.nextTeleportHeight).toBeNull();
    s.items.nanobots = 1;
    transact(s, "use-item", "nanobots");
    expect(s.items.nanobots).toBe(1);
  });
  it("radiators reduce continuous lava contact", () => {
    let s = state();
    put(s, 4, 1, tile("lava", "deepstone"));
    s = debug.setMinerPosition(s, 332, 85);
    s.miner.travel = false;
    s.tiers.radiator = 5;
    const n = advance(s, idle, 1);
    expect(n.miner.hull).toBeCloseTo(100 - C.LAVA_CONTACT_DPS * 0.2);
  });
});
describe("economy, progression, saving and debug domains", () => {
  it("sells at fixed values and upgrades add only the capacity difference", () => {
    const s = state();
    s.ore = { ferron: 5, roselite: 1 };
    transact(s, "sell");
    expect(s.credits).toBe(1280);
    expect(s.creditsEarned).toBe(1280);
    s.miner.fuel = 30;
    transact(s, "buy-upgrade", "fuel");
    expect(s.miner.fuel).toBe(105);
    expect(s.credits).toBe(980);
    transact(s, "fill-fuel");
    expect(s.miner.fuel).toBe(175);
    expect(s.credits).toBe(910);
  });
  it("fabricates in order, consumes materials and stops the Core timer", () => {
    const s = state();
    s.credits = 30000;
    s.satchel = { resonite: 1, cryenite: 1, coreSample: true };
    s.coreTimer = 30;
    for (let i = 0; i < 5; i++) transact(s, "fabricate");
    expect(s.installed).toBe(5);
    expect(s.coreTimer).toBeNull();
    expect(s.credits).toBe(4500);
    transact(s, "launch");
    expect(s.screen).toBe("victory");
    expect(s.summary?.componentsInstalled).toBe(5);
  });
  it("saves and restores a surface pose and refuses a live timer", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    let s = state();
    s.credits = 217;
    s = debug.save(s);
    expect(s.hasSave).toBe(true);
    s.screen = "title";
    s = choose(s, 0);
    expect(s.credits).toBe(217);
    expect(s.miner.y).toBe(8);
    s = debug.setCoreCarried(s, true);
    s = debug.save(s);
    expect(s.note).toContain("refused");
    s.mode = "hardcore";
    finish(s, "hull-destroyed");
    expect(store.size).toBe(0);
  });
  it("resizes cells without changing their bands and removes the old chamber", () => {
    let s = state();
    put(s, 4, 140, tile("rock", "rockbed"));
    s = debug.setTileHealth(s, 4, 140, 3);
    s = debug.setWorldSize(s, "marathon");
    expect(at(s, 4, 140)).toMatchObject({ band: "rockbed", health: 3 });
    expect(at(s, 16, 500).kind).toBe("tunnel");
    expect(at(s, 16, 1000).kind).toBe("core");
  });
  it("locks the scanner onto the nearest missing material", () => {
    const s = state();
    s.tiers.scanner = 2;
    put(s, 6, 2, tile("material", "rockbed", null, "resonite"));
    expect(scanner(s)).toMatchObject({ locked: true, target: "resonite" });
    s.satchel.resonite = 1;
    expect(scanner(s).locked).toBe(false);
  });
  it("fails invalid poses loudly and reads without advancing", () => {
    const s = state();
    expect(() => debug.setFuel(s, -1)).toThrow();
    expect(() => debug.setTier(s, "fuel", 6)).toThrow();
    expect(() => debug.setCoreTimer(s, 10)).toThrow();
    expect(() => debug.setTile(s, 99, 2, "rock")).toThrow();
    expect(() => debug.setCargo(s, "nonsense" as C.OreId, 1)).toThrow();
    expect(debug.snapshot(s).depthMeters).toBe(depth(s));
    expect(debug.tileAt(s, -1, 500)).toMatchObject({ kind: "bedrock" });
  });
  it("generates each material once and opens the cave mouth at every size", () => {
    for (const worldSize of C.WORLD_SIZES) {
      let s = state();
      s.worldSize = worldSize;
      s = start(s);
      expect(s.mine.filter((t) => t.material === "resonite")).toHaveLength(1);
      expect(s.mine.filter((t) => t.material === "cryenite")).toHaveLength(1);
      expect(at(s, 26, 1).kind).toBe("tunnel");
      expect(at(s, 16, s.coreRow).kind).toBe("core");
    }
  });
  it("menus select sizes and expose matching control rectangles", () => {
    let s = fresh({ images: {}, fx: {} });
    s = choose(s, 0);
    expect(s.screen).toBe("mode-select");
    s = choose(s, 1);
    s = choose(s, 2);
    expect(s.mode).toBe("hardcore");
    expect(s.coreRow).toBe(1000);
    s.panel = "fuel-depot";
    expect(controlRect(s, "buy-fuel", null)).not.toBeNull();
    expect(menu(s)).toEqual([]);
  });
});
describe("real engine integration", () => {
  it("registers input and drives the miner through dispatched keys", async () => {
    const events = new EventTarget();
    const canvas = createCanvas(1280, 720);
    const engine = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: 1280,
      height: 720,
      game,
      clock: new ConstantClock(1000 / 60),
      surface: {
        cssWidth: () => 1280,
        cssHeight: () => 720,
        dpr: () => 1,
        events: () => events,
      },
    });
    await engine.initialize();
    engine.apply((s) => debug.setScreen(s, "in-mine"));
    engine.apply((s) => debug.setTile(s, 4, 1, "rock"));
    engine.apply((s) => debug.setTile(s, 4, 2, "rock"));
    const event = new Event("keydown");
    Object.defineProperty(event, "code", { value: "KeyS" });
    events.dispatchEvent(event);
    await engine.advance(30);
    expect(engine.debug.tileAt(engine.state, 4, 1).kind).toBe("tunnel");
    expect(engine.state.simTime).toBeCloseTo(0.5);
    expect(engine.diagnostics().length).toBeGreaterThan(10);
    engine.destroy();
  });
});
