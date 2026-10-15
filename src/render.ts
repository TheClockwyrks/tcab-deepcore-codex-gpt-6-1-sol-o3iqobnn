import * as C from "./constants";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import {
  type ReadState,
  at,
  depth,
  maxFuel,
  maxHull,
  load,
  slots,
  jet,
  buildings,
  scanner,
} from "./model";
import {
  menu,
  menuRect,
  controls,
  nearBuilding,
  panelSubtitle,
} from "./interface";
const ink = "#e2e5d5",
  muted = "#8babae",
  gold = "#e9b966",
  teal = "#80c8bb";
function text(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  font = "monospace",
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.fillText(t, x, y);
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "#12232ded",
  stroke = "#36505a",
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function image(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
) {
  const img = s.assets.images[path] as ImageBitmap | undefined;
  if (img) {
    if (w !== undefined && h !== undefined) ctx.drawImage(img, x, y, w, h);
    else ctx.drawImage(img, x, y);
  }
}
const counts: Record<C.MinerState, number> = {
  idle: 2,
  walk: 4,
  "drill-down": 3,
  "drill-side": 3,
  jetpack: 3,
  fall: 2,
  hurt: 2,
  "fuel-out": 2,
};
function particles(s: ReadState, ctx: CanvasRenderingContext2D) {
  for (const e of s.effects) {
    const system = s.assets.fx[e.name];
    if (!system) continue;
    ctx.save();
    ctx.translate(e.x - 120, e.y - 120);
    let drawing = false;
    const proxy = new Proxy(ctx, {
      get(target, key) {
        if (key === "canvas") return { width: 240, height: 240 };
        if (key === "fill" && !drawing) return () => {};
        const value = Reflect.get(target, key, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, key, value) {
        Reflect.set(target, key, value, target);
        return true;
      },
    });
    const player = new ParticleCanvasPlayer(
      system as ConstructorParameters<typeof ParticleCanvasPlayer>[0],
      proxy,
      { seed: e.seed, clear: false, pixelRadius: 2 },
    );
    drawing = true;
    for (let t = 0; t < e.age; t += 1 / 60)
      player.simulator.step(Math.min(1 / 60, e.age - t) * 1000);
    player.update(0);
    ctx.restore();
  }
}
function world(s: ReadState, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
  ctx.clip();
  const shake = s.shake > 0 ? Math.min(s.shake, 1) * 7 : 0;
  ctx.translate(
    -s.camera.x + Math.sin(s.simTime * 89) * shake,
    C.HUD_H - s.camera.y + Math.cos(s.simTime * 73) * shake,
  );
  const skyY = Math.min(-400, s.camera.y);
  image(
    s,
    ctx,
    "surface/sky.png",
    s.camera.x,
    skyY,
    C.VIEW_W,
    Math.max(480, C.SURFACE_Y - skyY),
  );
  const minCol = Math.max(0, Math.floor(s.camera.x / C.TILE)),
    maxCol = Math.min(31, Math.ceil((s.camera.x + C.VIEW_W) / C.TILE));
  const minRow = Math.max(1, Math.floor(s.camera.y / C.TILE)),
    maxRow = Math.min(s.coreRow, Math.ceil((s.camera.y + C.VIEW_H) / C.TILE));
  for (let row = minRow; row <= maxRow; row++)
    for (let col = minCol; col <= maxCol; col++) {
      const t = at(s, col, row),
        x = col * C.TILE,
        y = row * C.TILE,
        band = t.band ?? "coreshell";
      image(
        s,
        ctx,
        `tiles/${band}-${(col * 7 + row * 13) % C.TILE_VARIANTS}.png`,
        x,
        y,
      );
      if (t.kind === "bedrock") image(s, ctx, "tiles/bedrock.png", x, y);
      else if (t.kind === "tunnel" || t.kind === "lava") {
        const same = (c: number, r: number) => at(s, c, r).kind === t.kind;
        const left = same(col - 1, row),
          right = same(col + 1, row),
          up = same(col, row - 1) || row === 1,
          down = same(col, row + 1);
        const lip = 7,
          l = left ? 0 : lip,
          r = right ? 0 : lip,
          u = up ? 0 : lip,
          d = down ? 0 : lip;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + l, y + u, C.TILE - l - r, C.TILE - u - d, 9);
        if (up) ctx.rect(x + lip, y, C.TILE - lip * 2, 20);
        if (down) ctx.rect(x + lip, y + C.TILE - 20, C.TILE - lip * 2, 20);
        if (left) ctx.rect(x, y + lip, 20, C.TILE - lip * 2);
        if (right) ctx.rect(x + C.TILE - 20, y + lip, 20, C.TILE - lip * 2);
        if (left && up && same(col - 1, row - 1)) ctx.rect(x, y, 20, 20);
        if (right && up && same(col + 1, row - 1)) ctx.rect(x + 60, y, 20, 20);
        if (left && down && same(col - 1, row + 1)) ctx.rect(x, y + 60, 20, 20);
        if (right && down && same(col + 1, row + 1))
          ctx.rect(x + 60, y + 60, 20, 20);
        ctx.clip();
        image(
          s,
          ctx,
          t.kind === "lava"
            ? `hazards/lava/frame0${Math.floor(s.animTime * 5) % 2}.png`
            : "tiles/tunnel.png",
          x,
          y,
        );
        ctx.restore();
        // Solid diagonal corners remain rounded dirt nubs in joined passages.
        for (const [dx, dy, joined] of [
          [-1, -1, left && up],
          [1, -1, right && up],
          [-1, 1, left && down],
          [1, 1, right && down],
        ] as const) {
          if (joined && !same(col + dx, row + dy)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(
              x + (dx < 0 ? 0 : 80),
              y + (dy < 0 ? 0 : 80),
              lip,
              0,
              Math.PI * 2,
            );
            ctx.clip();
            image(
              s,
              ctx,
              `tiles/${band}-${(col * 7 + row * 13) % 3}.png`,
              x,
              y,
            );
            ctx.restore();
          }
        }
      } else if (t.kind === "stone")
        image(s, ctx, `tiles/stone-${(col + row) % 2}.png`, x, y);
      else if (t.kind === "ore" && t.ore)
        image(s, ctx, `ore/${t.ore}.png`, x, y);
      else if (t.kind === "material")
        image(s, ctx, `materials/${t.material}.png`, x, y);
      else if (t.kind === "core") image(s, ctx, "materials/core.png", x, y);
      if (t.health !== null && t.maxHealth && t.health < t.maxHealth) {
        const frame = Math.min(
          C.CRACK_FRAMES - 1,
          Math.floor((1 - t.health / t.maxHealth) * C.CRACK_FRAMES),
        );
        image(s, ctx, `tiles/crack/frame0${frame}.png`, x, y);
      }
      ctx.strokeStyle = "#a2b1a309";
      ctx.strokeRect(x + 0.5, y + 0.5, C.TILE - 1, C.TILE - 1);
    }
  if (s.camera.y < C.SURFACE_Y) {
    for (let c = 1; c < 31; c++)
      if (c !== C.CAVE_MOUTH_COL)
        image(
          s,
          ctx,
          "surface/ground.png",
          c * C.TILE,
          C.SURFACE_Y - 2,
          80,
          16,
        );
    for (const b of buildings) {
      image(s, ctx, `surface/${b.id}.png`, b.x, b.y, b.w, b.h);
      text(
        ctx,
        b.id.replace(/-/g, " ").toUpperCase(),
        b.x + 4,
        b.y - 13,
        13,
        muted,
      );
    }
    image(
      s,
      ctx,
      `rocket/stage${s.installed}.png`,
      buildings[5].x + 20,
      C.SURFACE_Y -
        158 -
        (s.screen === "victory" ? s.launchTime * s.launchTime * 70 : 0),
    );
    image(
      s,
      ctx,
      "surface/cave-mouth.png",
      C.CAVE_MOUTH_COL * C.TILE - 60,
      C.SURFACE_Y - 100,
      200,
      120,
    );
    text(
      ctx,
      "MINE ACCESS  ↓",
      C.CAVE_MOUTH_COL * C.TILE - 26,
      C.SURFACE_Y - 116,
      13,
      gold,
    );
  }
  if (s.screen !== "victory") {
    ctx.save();
    ctx.translate(s.miner.x + C.MINER_W / 2, s.miner.y + C.MINER_H / 2);
    if (s.miner.facing === "west") ctx.scale(-1, 1);
    const f =
      s.miner.state === "hurt"
        ? Math.min(
            counts.hurt - 1,
            Math.floor((C.HURT_TIME - s.hurt) * C.ANIM_FPS),
          )
        : Math.floor(s.animTime * C.ANIM_FPS) % counts[s.miner.state];
    image(
      s,
      ctx,
      `miner/${s.miner.state}/frame0${f}.png`,
      -40,
      -40,
      C.MINER_SPRITE,
      C.MINER_SPRITE,
    );
    ctx.restore();
  }
  if (s.coreGround) {
    const x = s.coreGround.col * C.TILE,
      y = s.coreGround.row * C.TILE;
    image(s, ctx, "materials/core-sample.png", x, y);
    text(ctx, `${Math.ceil(s.coreTimer ?? 0)}s`, x + 20, y - 8, 22, "#ffd6a1");
  }
  particles(s, ctx);
  const b = nearBuilding(s);
  if (b && s.screen === "in-mine" && !s.panel) {
    box(ctx, b.x - 8, C.SURFACE_Y + 20, 220, 34, "#10232ce8");
    text(
      ctx,
      `[ E ] ${b.id === "save-pad" ? "SAVE EXPEDITION" : "OPEN " + b.id.split("-")[0].toUpperCase()}`,
      b.x + 5,
      C.SURFACE_Y + 43,
      13,
      gold,
    );
  }
  ctx.restore();
  // Gentle edge shading keeps the illuminated work area readable.
  const v = ctx.createRadialGradient(640, 380, 240, 640, 380, 760);
  v.addColorStop(0, "#050e1700");
  v.addColorStop(1, "#050e1755");
  ctx.fillStyle = v;
  ctx.fillRect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
}
function hud(s: ReadState, ctx: CanvasRenderingContext2D) {
  box(ctx, 0, 0, C.STAGE_W, C.HUD_H, "#0d1b25", "#3d555d");
  function gauge(
    name: string,
    x: number,
    value: number,
    max: number,
    c: string,
  ) {
    image(s, ctx, `icons/${name}.png`, x, 16, 24, 24);
    text(ctx, name.toUpperCase(), x + 31, 19, 10, muted);
    text(ctx, `${Math.ceil(value)} / ${max}`, x + 31, 35, 13, ink);
    ctx.fillStyle = "#263b43";
    ctx.fillRect(x + 31, 42, 121, 3);
    ctx.fillStyle = c;
    ctx.fillRect(x + 31, 42, 121 * Math.min(1, value / max), 3);
  }
  gauge(
    "fuel",
    18,
    s.miner.fuel,
    maxFuel(s),
    s.miner.fuel / maxFuel(s) < C.LOW_FUEL_FRACTION ? "#ec8065" : gold,
  );
  gauge(
    "hull",
    195,
    s.miner.hull,
    maxHull(s),
    s.miner.hull / maxHull(s) < C.LOW_HULL_FRACTION ? "#ec8065" : teal,
  );
  image(s, ctx, "icons/cargo.png", 380, 16, 24, 24);
  text(
    ctx,
    load(s) >= jet(s).liftLimitKg
      ? C.OVERLOAD
      : `CARGO ${slots(s)}/${C.CARGO_TIERS[s.tiers.cargo - 1]}`,
    413,
    23,
    12,
    slots(s) >= C.CARGO_TIERS[s.tiers.cargo - 1] ? gold : muted,
  );
  text(ctx, `${load(s)} kg`, 413, 41, 13, ink);
  image(s, ctx, "icons/credits.png", 557, 16, 24, 24);
  text(ctx, "CREDITS", 590, 20, 10, muted);
  text(ctx, s.credits.toLocaleString(), 590, 39, 16, gold);
  image(s, ctx, "icons/depth.png", 715, 16, 24, 24);
  text(ctx, "DEPTH", 748, 20, 10, muted);
  text(ctx, `${Math.floor(depth(s))} m`, 748, 39, 16, ink);
  for (const [i, m] of C.MATERIALS.entries()) {
    image(s, ctx, `icons/${m}.png`, 864 + i * 62, 15, 24, 24);
    text(
      ctx,
      String(s.satchel[m]),
      890 + i * 62,
      34,
      13,
      s.satchel[m] ? teal : muted,
    );
  }
  for (const c of controls(s).filter((c) => c.rect.y < 56)) {
    box(ctx, c.rect.x, c.rect.y, c.rect.w, c.rect.h, "#1b303a", "#3b535a");
    text(ctx, c.label, c.rect.x + 10, c.rect.y + 25, 12, muted);
  }
}
/** Field supply symbols are interface art, distinct from the produced sprites. */
function supplyIcon(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 2;
  if (id === "dynamite" || id === "plastic-explosives") {
    for (let i = 0; i < 3; i++) ctx.fillRect(3 + i * 5, 8, 3, 14);
    ctx.strokeStyle = teal;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(13, 2);
    ctx.lineTo(19, 4);
    ctx.stroke();
  } else if (id === "nanobots") {
    ctx.fillRect(9, 3, 6, 21);
    ctx.fillRect(2, 10, 20, 6);
  } else if (id === "emergency-fuel") {
    ctx.strokeRect(4, 7, 16, 16);
    ctx.fillRect(8, 2, 8, 4);
    ctx.fillRect(8, 13, 8, 6);
  } else {
    ctx.beginPath();
    ctx.arc(12, 13, 9, 0, Math.PI * 1.7);
    ctx.stroke();
    if (id === "matter-transmitter") {
      ctx.fillRect(8, 9, 8, 8);
      ctx.fillRect(2, 23, 20, 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(13, 6);
      ctx.lineTo(8, 14);
      ctx.lineTo(16, 14);
      ctx.lineTo(10, 23);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function overlay(s: ReadState, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#07121bc9";
  ctx.fillRect(0, 56, 1280, 664);
  box(ctx, 204, 124, 880, 518, "#10222cf5", "#48606a");
  text(ctx, "DEEPCORE  /  CAMP TERMINAL", 240, 161, 11, muted);
  text(
    ctx,
    (s.panel ?? "").replace(/-/g, " ").toUpperCase(),
    240,
    198,
    27,
    ink,
  );
  text(ctx, panelSubtitle(s), 240, 220, 12, teal);
  if (s.panel === "launch-pad")
    C.ROCKET_COMPONENTS.forEach((p, i) => {
      text(
        ctx,
        i < s.installed ? "✓" : "0" + (i + 1),
        246,
        266 + i * 52,
        19,
        i < s.installed ? teal : muted,
      );
      text(ctx, p.name, 290, 266 + i * 52, 18, i < s.installed ? teal : ink);
      text(
        ctx,
        `${p.credits.toLocaleString()} Cr  /  ${p.material ?? "Credits"}`,
        600,
        266 + i * 52,
        13,
        muted,
      );
    });
  if (s.panel === "ore-market") {
    let y = 255;
    for (const m of C.MINERALS) {
      const count = s.ore[m.id] ?? 0;
      if (count) {
        image(s, ctx, `ore/${m.id}.png`, 240, y - 20, 26, 26);
        text(ctx, `${m.name} ×${count}`, 280, y, 15, ink);
        text(
          ctx,
          `${count * m.weightKg} kg   ·   ${count * m.value} Cr`,
          650,
          y,
          14,
          gold,
        );
        y += 23;
      }
    }
    if (!slots(s))
      text(
        ctx,
        "The cargo bay is empty. The rock below is not.",
        240,
        310,
        16,
        muted,
      );
  }
  if (s.panel === "inventory" && !slots(s)) {
    text(ctx, "YOUR CARGO BAY IS EMPTY", 240, 278, 15, muted);
    text(
      ctx,
      "Minerals collected by drilling appear here.",
      240,
      305,
      12,
      muted,
    );
    text(
      ctx,
      "Drop one unit at a time to lighten the climb.",
      240,
      329,
      12,
      muted,
    );
  }
  if (s.panel === "inventory" && C.ITEM_IDS.every((id) => s.items[id] === 0)) {
    text(ctx, "NO FIELD SUPPLIES", 650, 278, 15, muted);
    text(ctx, "Visit the Supply Depot before a deep run.", 650, 305, 12, muted);
  }
  const list = controls(s).filter(
    (c) => c.rect.y > 56 && c.id !== "dismiss-notice",
  );
  list.forEach((c, i) => {
    const r = c.rect;
    box(
      ctx,
      r.x,
      r.y,
      r.w,
      r.h,
      c.enabled ? (i === s.panelIndex ? "#2b4148" : "#1b313a") : "#14262f",
      c.enabled ? "#536a6c" : "#293e48",
    );
    if (c.id === "buy-item" || c.id === "use-item")
      supplyIcon(ctx, c.subject ?? "", r.x + 8, r.y + 5);
    text(
      ctx,
      c.label,
      r.x + (c.id === "buy-item" || c.id === "use-item" ? 42 : 12),
      r.y + 25,
      s.panel === "inventory" ? 12 : 14,
      c.enabled ? ink : "#60767e",
    );
    if (c.detail) {
      ctx.textAlign = "right";
      text(
        ctx,
        c.detail,
        r.x + r.w - 12,
        r.y + 25,
        s.panel === "inventory" ? 10 : 12,
        c.enabled ? gold : "#60767e",
      );
      ctx.textAlign = "left";
    }
  });
  text(
    ctx,
    "↑ ↓  SELECT     ENTER  CONFIRM     ESC  CLOSE",
    240,
    621,
    11,
    muted,
  );
}
function title(s: ReadState, ctx: CanvasRenderingContext2D) {
  // The cover is an actual cutaway of the produced mine sprites.
  image(s, ctx, "surface/sky.png", 0, 0, 1280, 720);
  ctx.fillStyle = "#07141abb";
  ctx.fillRect(0, 0, 1280, 720);
  ctx.save();
  ctx.beginPath();
  ctx.rect(660, 0, 620, 720);
  ctx.clip();
  for (let r = 0; r < 10; r++)
    for (let c = 8; c < 17; c++) {
      const x = c * 80 - 15,
        y = r * 80 - 20;
      const b = C.BANDS[Math.min(3, Math.floor(r / 3))];
      image(s, ctx, `tiles/${b}-${(r + c) % 3}.png`, x, y);
      const open =
        (c === 11 && r < 6) ||
        (r === 5 && c >= 10 && c <= 13) ||
        (c === 13 && r >= 5);
      if (open) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 5, y - 2, 70, 84, 14);
        ctx.clip();
        image(s, ctx, "tiles/tunnel.png", x, y);
        ctx.restore();
      } else if ((c * 3 + r * 7) % 9 === 0)
        image(s, ctx, `ore/${C.ORE_IDS[Math.min(9, r)]}.png`, x, y);
      if (r === 8 && c > 13)
        image(
          s,
          ctx,
          `hazards/lava/frame0${Math.floor(s.simTime * 4) % 2}.png`,
          x + 7,
          y + 7,
          66,
          66,
        );
    }
  const f = Math.floor(s.simTime * C.ANIM_FPS) % 3;
  image(s, ctx, `miner/drill-down/frame0${f}.png`, 865, 302, 112, 112);
  ctx.restore();
  const shade = ctx.createLinearGradient(560, 0, 850, 0);
  shade.addColorStop(0, "#0b1924");
  shade.addColorStop(1, "#0b192400");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 850, 720);
  text(ctx, "EST. 2089   /   OFF-WORLD SALVAGE DIVISION", 100, 104, 12, teal);
  text(ctx, C.TITLE_TEXT, 94, 214, 86, ink, "Impact, sans-serif");
  text(ctx, "THE ONLY WAY OUT IS DOWN.", 100, 253, 15, gold);
  text(ctx, "A subterranean dig-and-build expedition", 100, 294, 14, muted);
  const heading: Partial<Record<C.ScreenName, string>> = {
    "mode-select": "CHOOSE YOUR STAKES",
    "size-select": "CHOOSE YOUR DESCENT",
    paused: "EXPEDITION PAUSED",
    victory: "YOU MADE IT HOME",
    "game-over": "SIGNAL LOST",
  };
  if (heading[s.screen]) {
    box(ctx, 90, 126, 560, 202, "#0d1f29");
    text(
      ctx,
      heading[s.screen]!,
      100,
      194,
      32,
      s.screen === "game-over" ? "#ed9a7f" : ink,
    );
  }
  if (s.screen === "mode-select") {
    text(
      ctx,
      "STANDARD · Restore your last save after death.",
      100,
      242,
      12,
      muted,
    );
    text(
      ctx,
      "HARDCORE · Death deletes the save. One chance.",
      100,
      271,
      12,
      gold,
    );
  }
  if (s.screen === "size-select") {
    text(ctx, "QUICK  1250 m   /   STANDARD  2500 m", 100, 242, 12, muted);
    text(
      ctx,
      "MARATHON  5000 m · The same riches. A longer climb.",
      100,
      271,
      12,
      gold,
    );
  }
  if (s.summary && (s.screen === "victory" || s.screen === "game-over")) {
    text(
      ctx,
      `${Math.floor(s.summary.deepestDepthMeters)} m  ·  ${s.summary.creditsEarned.toLocaleString()} Cr  ·  ${Math.floor(s.summary.elapsedSeconds / 60)} min`,
      100,
      245,
      15,
      gold,
    );
    text(
      ctx,
      `${s.mode.toUpperCase()}  /  ROCKET ${s.installed}/5${s.summary.deathCause ? "  /  " + s.summary.deathCause : ""}`,
      100,
      276,
      12,
      muted,
    );
  }
  if (s.screen === "how-to-play") {
    box(ctx, 74, 130, 1132, 474, "#0e212bf8");
    text(ctx, "THE FIELD MANUAL", 100, 180, 29, ink);
    const lines = [
      [
        "01 / DIG",
        "A D / ← → walk and drill sideways. S / ↓ drills down. Never up.",
      ],
      [
        "02 / RETURN",
        "W / ↑ / SPACE fires the jetpack. Falling is free; climbing costs fuel.",
      ],
      [
        "03 / TRADE",
        "E / ENTER opens camp services. Sell ore, refuel, repair, upgrade.",
      ],
      [
        "04 / PACK LIGHT",
        "I opens cargo. Slots limit quantity; weight limits lift. Drop ore to climb.",
      ],
      [
        "05 / GO DEEPER",
        "Watch for gas, lava and hard landings. Buy a scanner for rare materials.",
      ],
      [
        "06 / LEAVE",
        "Build five rocket parts. Bring the Core Sample home before its 90s timer.",
      ],
      [
        "07 / STAY ALIVE",
        "Save at the Save Pad. Standard restores a save; Hardcore death deletes it.",
      ],
      [
        "FIELD KEYS",
        "1–6 supplies · J jettisons the Sample · ESC pauses · M mutes audio",
      ],
    ];
    lines.forEach(([h, t], i) => {
      text(ctx, h, 100, 222 + i * 44, 12, gold);
      text(ctx, t, 265, 222 + i * 44, 13, ink);
    });
  }
  menu(s).forEach((label, i) => {
    const r = menuRect(s, i)!;
    const selected = i === s.menuIndex;
    box(
      ctx,
      r.x,
      r.y,
      r.w,
      r.h,
      selected ? "#2b4247" : "#122630c9",
      selected ? gold : "#36515b",
    );
    text(
      ctx,
      selected ? "›" : "·",
      r.x + 18,
      r.y + 33,
      25,
      selected ? gold : muted,
    );
    text(ctx, label, r.x + 48, r.y + 31, 16, selected ? ink : muted);
  });
  text(ctx, "DEPTH IS CHEAP. HEIGHT IS EXPENSIVE.", 100, 679, 11, muted);
  text(
    ctx,
    "A / D  MOVE     S  DRILL     SPACE  THRUST",
    768,
    680,
    11,
    "#b1c6be",
  );
}
export function render(s: ReadState, ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = false;
  if (
    ["title", "mode-select", "size-select", "how-to-play"].includes(s.screen)
  ) {
    title(s, ctx);
    return;
  }
  world(s, ctx);
  hud(s, ctx);
  if (
    s.screen === "victory" ||
    s.screen === "game-over" ||
    s.screen === "paused"
  ) {
    ctx.fillStyle = "#07151baf";
    ctx.fillRect(0, 56, 1280, 664);
    text(
      ctx,
      s.screen === "victory"
        ? "ESCAPE VELOCITY"
        : s.screen === "paused"
          ? "EXPEDITION PAUSED"
          : "SIGNAL LOST",
      100,
      205,
      56,
      ink,
      "Impact, sans-serif",
    );
    text(
      ctx,
      s.screen === "victory"
        ? "You built a way home."
        : s.screen === "paused"
          ? "The mine can wait."
          : (s.summary?.deathCause ?? "Expedition ended")
              .replace(/-/g, " ")
              .toUpperCase(),
      102,
      252,
      22,
      gold,
    );
    if (s.summary) {
      text(
        ctx,
        `${Math.floor(s.summary.deepestDepthMeters)} m deep · ${s.summary.creditsEarned.toLocaleString()} Credits earned · ${Math.floor(s.summary.elapsedSeconds)} seconds`,
        102,
        294,
        15,
        ink,
      );
      text(
        ctx,
        `${s.summary.mode.toUpperCase()} / ${s.summary.componentsInstalled} OF 5 COMPONENTS INSTALLED`,
        102,
        324,
        12,
        muted,
      );
    }
    menu(s).forEach((label, i) => {
      const r = menuRect(s, i)!;
      box(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        i === s.menuIndex ? "#3a4b48" : "#192e37",
        gold,
      );
      text(ctx, label, r.x + 24, r.y + 31, 16);
    });
    return;
  }
  const target = scanner(s);
  if (target.locked) {
    box(ctx, 465, 76, 350, 38);
    text(
      ctx,
      `SCAN ${target.target?.toUpperCase()}  ${target.distanceTiles?.toFixed(1)} tiles  ${target.dirY > 0 ? "↓" : "↑"} ${target.dirX > 0 ? "→" : "←"}`,
      480,
      101,
      13,
      teal,
    );
  }
  if (s.satchel.coreSample && s.coreTimer !== null) {
    box(ctx, 470, 124, 340, 58, "#482a29ed", "#e5a161");
    text(ctx, `CORE UNSTABLE   ${s.coreTimer.toFixed(1)}s`, 485, 151, 20, gold);
    text(ctx, "RETURN TO LAUNCH PAD  ·  J JETTISON", 485, 172, 11, ink);
  }
  if (!s.panel) {
    box(ctx, 20, 665, 475, 34, "#10212bde");
    text(
      ctx,
      "A D  MOVE / CUT   S  DRILL   SPACE  THRUST   E  USE",
      32,
      687,
      11,
      muted,
    );
    text(
      ctx,
      `${s.worldSize.toUpperCase()} / ${C.BANDS[Math.min(3, Math.floor((Math.max(0, depth(s) / 5) / (s.coreRow - 1)) * 4))].toUpperCase()}`,
      1000,
      687,
      11,
      muted,
    );
  }
  if (s.panel) overlay(s, ctx);
  if (s.notice && s.notice.age >= C.NOTICE_DELAY) {
    box(ctx, 310, 580, 660, 70, "#293338f0", gold);
    text(
      ctx,
      s.notice.hazard === "gas"
        ? "VOLATILE GAS · Watch for pale wisps in the rock."
        : "LAVA · Upgrade your radiator. Find a route around the pool.",
      332,
      609,
      14,
      gold,
    );
    text(
      ctx,
      "Hull absorbs the damage. Repairs are available at the Fuel Depot.",
      332,
      634,
      12,
      ink,
    );
  }
  if (s.noteTime > 0) {
    box(ctx, 320, 70, 640, 36, "#172d35f0", "#567675");
    ctx.textAlign = "center";
    text(ctx, s.note, 640, 94, 13, ink);
    ctx.textAlign = "left";
  }
}
