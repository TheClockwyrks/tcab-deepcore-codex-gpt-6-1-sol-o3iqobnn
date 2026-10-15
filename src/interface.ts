import * as C from "./constants";
import {
  type ReadState,
  type DeepcoreState,
  type Rect,
  slots,
  load,
  maxFuel,
  maxHull,
  buildings,
} from "./model";
import { start, restore, transact } from "./simulation";
export function menu(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return s.hasSave ? C.TITLE_ITEMS : C.TITLE_ITEMS.slice(1);
    case "mode-select":
      return C.MODE_ITEMS;
    case "size-select":
      return C.SIZE_ITEMS;
    case "how-to-play":
      return C.HOW_TO_PLAY_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "victory":
      return C.VICTORY_ITEMS;
    case "game-over":
      return s.mode === "standard" && s.hasSave
        ? C.GAME_OVER_SAVE_ITEMS
        : C.GAME_OVER_ITEMS;
    default:
      return [];
  }
}
export function menuRect(s: ReadState, index: number): Rect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menu(s).length)
    return null;
  return {
    x: 100,
    y: s.screen === "how-to-play" ? 624 : 366 + index * 64,
    w: 430,
    h: 50,
  };
}
export function back(s: DeepcoreState) {
  if (s.screen === "paused") {
    s.screen = "in-mine";
    s.menuIndex = 0;
  } else if (s.screen === "size-select") {
    s.screen = "mode-select";
    s.menuIndex = C.MODES.indexOf(s.mode);
  } else {
    const help = s.screen === "how-to-play";
    s.screen = "title";
    s.menuIndex = (s.hasSave ? 1 : 0) + (help ? 1 : 0);
  }
}
export function choose(s: DeepcoreState, index: number) {
  const label = menu(s)[index];
  s.menuIndex = 0;
  if (label === "CONTINUE" || label === "CONTINUE FROM SAVE") return restore(s);
  if (label === "NEW EXPEDITION") {
    s.screen = "mode-select";
    return s;
  }
  if (label === "HOW TO PLAY") {
    s.screen = "how-to-play";
    return s;
  }
  if (label === "BACK") {
    back(s);
    return s;
  }
  if (s.screen === "mode-select") {
    s.mode = C.MODES[index];
    s.screen = "size-select";
    return s;
  }
  if (s.screen === "size-select") {
    s.worldSize = C.WORLD_SIZES[index];
    return start(s);
  }
  if (label === "RESUME") {
    s.screen = "in-mine";
    return s;
  }
  if (label === "RESTART" || label === "PLAY AGAIN") return start(s);
  back(s);
  return s;
}
export interface Control {
  id: string;
  subject: string | null;
  label: string;
  detail: string;
  rect: Rect;
  enabled: boolean;
}
export function controls(s: ReadState): Control[] {
  if (s.screen !== "in-mine") return [];
  const result: Control[] = [];
  const add = (
    id: string,
    label: string,
    detail: string,
    x: number,
    y: number,
    w: number,
    enabled = true,
    subject: string | null = null,
  ) =>
    result.push({
      id,
      label,
      detail,
      subject,
      rect: { x, y, w, h: id === "drop-ore" ? 25 : 38 },
      enabled,
    });
  add("inventory", "I · CARGO", "", 1016, 9, 108);
  add("pause", "Ⅱ", "", 1132, 9, 48);
  add("mute", s.muted ? "♪ OFF" : "♪", "", 1188, 9, 76);
  if (s.notice && s.notice.age >= C.NOTICE_DELAY)
    result.push({
      id: "dismiss-notice",
      subject: null,
      label: "",
      detail: "",
      rect: { x: 310, y: 580, w: 660, h: 70 },
      enabled: true,
    });
  if (!s.panel) return result;
  add("close-panel", "×", "", 1024, 142, 44);
  const x = 240,
    y = 238,
    w = 800;
  if (s.panel === "fuel-depot") {
    add(
      "buy-fuel",
      `FUEL +${C.FUEL_BUY_INCREMENT}`,
      `${C.FUEL_PRICE} Cr / unit`,
      x,
      y,
      w,
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "fill-fuel",
      "FILL TANK",
      `${Math.ceil(maxFuel(s) - s.miner.fuel)} units missing`,
      x,
      y + 64,
      w,
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "buy-repair",
      `REPAIR +${C.REPAIR_BUY_INCREMENT}`,
      `${C.REPAIR_PRICE} Cr / point`,
      x,
      y + 128,
      w,
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
    add(
      "repair-full",
      "FULL REPAIR",
      `${Math.ceil(maxHull(s) - s.miner.hull)} hull missing`,
      x,
      y + 192,
      w,
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
  } else if (s.panel === "upgrade-shop")
    C.TRACKS.forEach((t, i) => {
      const tier = s.tiers[t],
        next = tier + 1,
        price = C.UPGRADE_PRICES[tier - 1],
        max = tier === C.MAX_TIER[t];
      const values: Record<C.TrackName, string> = {
        fuel: `${C.FUEL_TIERS[tier]} fuel`,
        hull: `${C.HULL_TIERS[tier]} hull`,
        cargo: `${C.CARGO_TIERS[tier]} slots`,
        drill: `Power ${next}`,
        jetpack: `${C.JETPACK_TIERS[tier]?.liftLimitKg} kg lift`,
        radiator: `${Math.round((C.RADIATOR_TIERS[tier] ?? 0) * 100)}% heat protection`,
        scanner: `${C.SCANNER_TIERS[tier]} tiles`,
      };
      add(
        "buy-upgrade",
        `${t.toUpperCase()}   ${tier} → ${max ? "MAX" : next}`,
        max ? "Fully upgraded" : `${values[t]}  ·  ${price} Cr`,
        x,
        y + i * 50,
        w,
        !max && s.credits >= price,
        t,
      );
    });
  else if (s.panel === "supply-depot")
    C.ITEMS.forEach((item, i) =>
      add(
        "buy-item",
        `${i + 1}   ${item.name.toUpperCase()}`,
        `${item.price.toLocaleString()} Cr  ·  Held ${s.items[item.id]}`,
        x,
        y + i * 56,
        w,
        s.credits >= item.price,
        item.id,
      ),
    );
  else if (s.panel === "launch-pad") {
    const part = C.ROCKET_COMPONENTS[s.installed];
    add(
      s.installed === 5 ? "launch" : "fabricate",
      s.installed === 5 ? C.LAUNCH : C.FABRICATE,
      part
        ? `${part.credits.toLocaleString()} Cr · ${part.material ?? "Credits only"}`
        : "ALL SYSTEMS READY",
      x,
      548,
      w,
      s.installed === 5 ||
        (!!part &&
          s.credits >= part.credits &&
          (part.material === "core-sample"
            ? s.satchel.coreSample
            : !part.material || s.satchel[part.material] > 0)),
    );
  } else {
    const held = C.MINERALS.filter((m) => (s.ore[m.id] ?? 0) > 0);
    if (s.panel === "inventory") {
      held.forEach((m, i) =>
        add(
          "drop-ore",
          `${m.name} ×${s.ore[m.id]}`,
          `${m.weightKg * (s.ore[m.id] ?? 0)} kg  ·  DROP 1`,
          240,
          230 + i * 27,
          360,
          true,
          m.id,
        ),
      );
      C.ITEMS.forEach((it, i) => {
        if (s.items[it.id])
          add(
            "use-item",
            `${i + 1}  ${it.name}`,
            `×${s.items[it.id]} · USE`,
            650,
            230 + i * 48,
            390,
            true,
            it.id,
          );
      });
      if (s.satchel.coreSample)
        add("jettison", C.JETTISON, "Unstable Core Sample", 650, 540, 390);
    } else {
      add(
        "sell",
        C.SELL,
        `${C.MINERALS.reduce((n, m) => n + (s.ore[m.id] ?? 0) * m.value, 0).toLocaleString()} Cr`,
        x,
        565,
        w,
        held.length > 0,
      );
    }
  }
  return result;
}
export function controlRect(s: ReadState, id: string, subject: string | null) {
  return (
    controls(s).find((c) => c.id === id && c.subject === subject)?.rect ?? null
  );
}
export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function activateBuilding(s: DeepcoreState, id: C.BuildingId) {
  if (id === "save-pad") transact(s, "save");
  else {
    s.panel = id;
    s.panelIndex = 0;
  }
}
export function nearBuilding(s: ReadState) {
  if (s.miner.y + C.MINER_H > C.SURFACE_Y + 2) return null;
  return (
    buildings.find(
      (b) =>
        s.miner.x + C.MINER_W / 2 >= b.x &&
        s.miner.x + C.MINER_W / 2 <= b.x + b.w,
    ) ?? null
  );
}
export function panelSubtitle(s: ReadState) {
  if (s.panel === "inventory")
    return `${slots(s)} / ${C.CARGO_TIERS[s.tiers.cargo - 1]} slots · ${load(s)} kg · Resonite ${s.satchel.resonite} · Cryenite ${s.satchel.cryenite}`;
  return "SURFACE SERVICES  /  " + s.credits.toLocaleString() + " CREDITS";
}
