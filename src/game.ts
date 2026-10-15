import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  copy,
  fresh,
  camera,
  buildings,
  effect,
  type DeepcoreState,
} from "./model";
import { debug, initialSave, snapshot, type DeepcoreDebugApi } from "./debug";
import { loadAssets } from "./assets";
import { advance, transact, useItem, finish } from "./simulation";
import {
  menu,
  menuRect,
  choose,
  back,
  controls,
  contains,
  activateBuilding,
  nearBuilding,
} from "./interface";
import { render } from "./render";
export type { DeepcoreState, DeepcoreDebugApi };
export const BACKGROUND = "#0b1924";
export const game: Game<DeepcoreState, DeepcoreDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTION_NAMES)
      api.input.register(name, { keys: [...C.ACTIONS[name]] });
    const fields = [
      "screen",
      "panel",
      "mode",
      "worldSize",
      "cargo",
      "satchel",
      "tiers",
      "credits",
      "depthMeters",
      "coreTimer",
      "scanner",
    ] as const;
    for (const field of fields)
      api.diagnostics.register(field, (s) => {
        const value = snapshot(s)[field];
        return typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      });
    api.diagnostics.register(
      "position",
      (s) => `${s.miner.x.toFixed(1)}, ${s.miner.y.toFixed(1)}`,
    );
    api.diagnostics.register(
      "velocity",
      (s) => `${s.miner.vx.toFixed(1)}, ${s.miner.vy.toFixed(1)}`,
    );
    api.diagnostics.register(
      "miner",
      (s) =>
        `${s.miner.state} / ${s.miner.facing} / grounded ${snapshot(s).miner.grounded}`,
    );
    api.diagnostics.register(
      "fuel",
      (s) => `${s.miner.fuel.toFixed(1)} / ${C.FUEL_TIERS[s.tiers.fuel - 1]}`,
    );
    api.diagnostics.register(
      "hull",
      (s) => `${s.miner.hull.toFixed(1)} / ${C.HULL_TIERS[s.tiers.hull - 1]}`,
    );
    api.diagnostics.register("drill", (s) =>
      JSON.stringify(snapshot(s).miner.drilling),
    );
    const s = fresh(await loadAssets(api), initialSave());
    camera(s, 0);
    return [s, debug];
  },
  update(state, api, dt) {
    let s = copy(state);
    s.simTime += dt;
    s.sounds = [];
    if (s.screen === "in-mine") {
      if (s.miner.hull <= 0) finish(s, "hull-destroyed");
      else if (s.miner.fuel <= 0 && s.miner.y + C.MINER_H > C.SURFACE_Y)
        finish(s, "fuel-out");
    }
    const input = api.input,
      pressed = (name: C.ActionName) => input.pressed(name);
    if (pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    api.audio.loop(C.CUES.music);
    const p = input.pointer();
    const samples = input.pointerSamples();
    const clickTargets = controls(s);
    const items = menu(s);
    const locate = (x: number, y: number) => {
      for (let i = 0; i < items.length; i++) {
        const r = menuRect(s, i);
        if (r && contains(r, x, y)) return "menu:" + i;
      }
      for (const c of clickTargets)
        if (c.enabled && contains(c.rect, x, y))
          return c.id + ":" + (c.subject ?? "");
      return null;
    };
    for (const sample of samples) {
      if (sample.type === "move" || sample.type === "down") {
        const hit = locate(sample.x, sample.y);
        if (hit?.startsWith("menu:")) s.menuIndex = Number(hit.split(":")[1]);
      }
      if (sample.type === "down") s.pointerDown = locate(sample.x, sample.y);
      if (sample.type === "up") {
        const hit = locate(sample.x, sample.y);
        if (hit && hit === s.pointerDown) {
          if (hit.startsWith("menu:")) s = choose(s, Number(hit.split(":")[1]));
          else {
            const [id, sub] = hit.split(":");
            if (id === "mute") api.audio.setMuted(!api.audio.muted());
            else transact(s, id, sub || null);
          }
        }
        s.pointerDown = null;
      }
    }
    if (s.screen !== "in-mine") {
      if (items.length) {
        if (pressed("down")) s.menuIndex = (s.menuIndex + 1) % items.length;
        if (pressed("up"))
          s.menuIndex = (s.menuIndex + items.length - 1) % items.length;
        if (pressed("activate")) s = choose(s, s.menuIndex);
        if (pressed("pause")) back(s);
      }
      if (s.screen === "victory") {
        s.launchTime += dt;
        s.effects = s.effects
          .map((e) => ({ ...e, age: e.age + dt }))
          .filter((e) => e.age < 1.4);
        if (
          s.launchTime < 3 &&
          Math.floor(s.launchTime * 12) !== Math.floor((s.launchTime - dt) * 12)
        )
          effect(
            s,
            "launch-exhaust",
            1750,
            75 - s.launchTime * s.launchTime * 70,
          );
      }
    } else {
      if (pressed("pause")) {
        if (s.panel) s.panel = null;
        else {
          s.screen = "paused";
          s.menuIndex = 0;
        }
      }
      if (pressed("inventory")) transact(s, "inventory");
      if (pressed("jettison")) transact(s, "jettison");
      C.ITEM_IDS.forEach((id, i) => {
        if (pressed(`supply${i + 1}` as C.ActionName)) useItem(s, id);
      });
      if (s.panel) {
        const list = controls(s).filter((c) => c.rect.y > 56);
        if (pressed("down")) s.panelIndex = (s.panelIndex + 1) % list.length;
        if (pressed("up"))
          s.panelIndex = (s.panelIndex + list.length - 1) % list.length;
        if (pressed("activate")) {
          const c = list[s.panelIndex];
          if (c?.enabled) transact(s, c.id, c.subject);
        }
      } else if (pressed("activate")) {
        const b = nearBuilding(s);
        if (b) activateBuilding(s, b.id);
      }
      if (input.pointerPressed() && !s.panel) {
        const wx = p.x + s.camera.x,
          wy = p.y + s.camera.y - C.HUD_H;
        const b = buildings.find((b) => contains(b, wx, wy));
        if (b && nearBuilding(s)?.id === b.id) activateBuilding(s, b.id);
        if (s.notice && p.y >= 580 && p.y <= 650) s.notice = null;
      }
      if (s.screen === "in-mine")
        s = advance(
          s,
          {
            left: input.value("left") > 0,
            right: input.value("right") > 0,
            down: input.value("down") > 0,
            up: input.value("up") > 0,
          },
          dt,
        );
    }
    for (const cue of s.sounds) api.audio.play(cue);
    for (const [cue, enabled] of [
      [C.CUES.drill, s.screen === "in-mine" && !s.panel && !!s.miner.drilling],
      [
        C.CUES.thrust,
        s.screen === "in-mine" && !s.panel && s.miner.state === "jetpack",
      ],
      [
        C.CUES.alarmFuel,
        s.screen === "in-mine" &&
          s.miner.fuel / C.FUEL_TIERS[s.tiers.fuel - 1] < C.LOW_FUEL_FRACTION,
      ],
    ] as const) {
      if (enabled) api.audio.loop(cue);
      else api.audio.stop(cue);
    }
    s.muted = api.audio.muted();
    return s;
  },
  render(s, api) {
    render(s, api.ctx);
  },
};
