# Deepcore

A browser mining expedition about the cost of coming home. Drill into four geological strata, fill your cargo bay, and jetpack back to the surface to sell your haul. Buy fuel, repairs, seven equipment upgrades and six field supplies. Find Resonite and Cryenite, race a destabilizing Core Sample to the launch pad, and fabricate a five-part escape rocket.

Choose Standard or Hardcore, and a Quick, Standard or Marathon mine. Standard lets you restore your last Save Pad visit after death. Hardcore deletes that save when you die.

## Run

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

## Production

```sh
npm run build
npm run preview
```

Serve `dist/` from any static host, including a subdirectory. No backend or network service is needed. All art, animation, effects and sound are original, committed assets under `assets/`; rebuilding requires no asset-generation tools.

## Controls

| Key | Action |
| --- | --- |
| A / D or left / right | Walk; drill a wall when grounded |
| S or down | Drill downward |
| W, up or Space | Jetpack thrust |
| E or Enter | Activate a surface building / confirm |
| I | Inventory; drop ore or use supplies |
| 1–6 | Dynamite, Plastic Explosives, Quantum Teleporter, Matter Transmitter, Nanobots, Emergency Fuel |
| J | Jettison an unstable Core Sample |
| Escape / P | Close a panel; pause / resume |
| M | Mute |
| Backtick | Engine diagnostics |

Menus and panels also support mouse and touch. Use up/down and Enter to select panel controls. The miner uses the keyboard.

Fuel buys altitude. Cargo slots limit quantity, but cargo weight limits lift: use the inventory to shed ore if overloaded. The drill never cuts upward. Save at the surface Save Pad; a live Core Sample prevents saving.

## Verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests cover immutable state transitions, frame partitioning, movement, mining cadence, cargo and lift, hazards, field supplies, shops, fabrication, persistence, debug poses, generation, menus, and actual engine input on a native canvas.
