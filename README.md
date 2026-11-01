# 🎓 CAMPUS CRAFT

**A voxel university campus you can actually walk through.** Built from scratch on three.js — no voxel engine libraries, no asset packs, no textures on disk. Every brick, tree, window, book and lamp on this campus is generated procedurally at load time from a seed, meshed greedily with baked ambient occlusion, and lit by a shader that knows about sun, sky, lamps and neon.

> You slept through three alarms. Orientation starts in twenty minutes.

---

## Play

```bash
npm install
npm run dev     # http://localhost:5173
```

Click **Enter Campus**. A cinematic flyover of the campus at dawn drops you into Halcyon Hall, Room 214.

| Action | Key |
| --- | --- |
| Move / look | `WASD` + mouse (drag to look if the browser blocks mouse capture) |
| Sprint / crouch | `Shift` / `Ctrl` |
| Jump | `Space` |
| Interact | `E` |
| Mine / place | `LMB` / `RMB` |
| Block hotbar | `1`–`9`, mouse wheel (after build mode unlocks) |
| Photo mode | `F` |
| Journal / map | `Tab` or `M` |
| Bag | `I` |
| Pause | `Esc` |

---

## What's in it

### A real voxel engine
- **256 × 256 × 56** voxel world (3.67 million cells), 8 × 8 chunk grid, 32³ chunks.
- **Greedy meshing** — coplanar faces are merged into big quads, cutting the campus to ~217k triangles / ~434k vertices total (it would be >2M naive).
- **Per-vertex ambient occlusion** computed from the 3 neighbours of every quad corner, folded into the vertex colour.
- **Baked light**: flood-filled sky light (with a downward bias so windows only light a few blocks inside) plus warm block light from lamps, neon, screens and vending machines. No real-time shadow maps, so it stays cheap.
- **One 512 × 512 procedurally painted pixel-art atlas** — 256 tiles painted at boot with a tiny software rasteriser (planks, brick, carpet, checkers, vending machine fronts, chalkboards, wood grain…).
- Chunk streaming on a budget: at most a couple of chunk meshes are built per frame, so exploring never hitches.

### The campus
| Place | What's inside |
| --- | --- |
| **Halcyon Hall** (dorm) | Three floors, corridor spine, 8 furnished rooms, two stair flights per floor, entry hall with glass doors, neon sign, courtyard with picnic tables |
| **Vox Hall** (lecture theatre) | Nine stepped tiers rising to a stage, 100+ desks, chalkboard, screen, acoustic panelling, ceiling lights |
| **The Archive** (library) | Two storeys of bookshelves, a ring balcony mezzanine, reading desks, a lost book that glows |
| **Commons** (cafeteria) | Counters, checkerboard floor, espresso machine, tables, vending machines |
| **Union** | Arcade wall, stage with neon, corner loft reached by a flight of stairs |
| **Rec Centre** (gym) | Court, hoops, weight racks, mats |
| **The Field** | Floodlit pitch, goals, ball |
| **The Pond** | Docks, reeds, lily pads, fireflies at night |
| Bus stop, notice boards, tunnels of trees, lamp posts, benches | … |

### Life sim systems
- **Freshers Week storyline** — 9 quest steps, from *"get out of bed"* to *"find the glowing book"*, with objective beams pointing at your next stop.
- **25 NPCs** with names, roles, colour-varied bodies, floating name tags and wander AI. Dialogue trees per NPC, plus ambient chatter.
- **Vitals** — energy, focus, social and caffeine, all draining in real time. Coffee helps. Sleep resets the day.
- **Day / night cycle** with a full sky shader (sun disc, moon, drifting fbm clouds, stars, dawn/dusk gradients), weather that rolls in rain and thunder, and a live clock.
- **Economy & progression** — XP, levels, coins, 12 achievements, a journal of discovered zones, and a bag of 8 items.
- **Photo mode** — free-look camera, grade filters, letterboxed frame.
- **Mine & build** — break any block (drops particles), place one of 16 block types once build mode unlocks.

### Presentation
- Custom UI design system: Outfit + Space Grotesk + JetBrains Mono, glassmorphic panels, animated compass/minimap, curved-digital vitals, framer-motion page transitions, vignette, film grain, HUD that animates out of the way.
- **Procedural lo-fi score** generated live in WebAudio (jazzy chords on a gentle schedule, vinyl crackle, rain ambience, thunder), plus synthesised footsteps/jump/UI/sfx — no audio files at all.
- Fully responsive, retina-aware, and it pauses cleanly when you alt-tab.

---

## Architecture

```
src/
  engine/          # engine, framework-free
    atlas.ts         procedural 256-tile texture atlas
    blocks.ts        62 block definitions
    world.ts         voxel storage + light baking
    mesher.ts        greedy mesher with AO
    voxelMaterial.ts custom GLSL: sun, wrap light, glow, fog, waves, dithered
    chunkManager.ts  chunk streaming, minimap colours, minimap texture
    player.ts        AABB voxel collision, step-up, swimming, DDA raycast
    sky.ts           sky dome shader, sun/moon, clouds, time-of-day palette
    npc.ts           voxel humanoids with name tags + wander AI
    particles.ts     fireflies, leaves, rain, birds
    audio.ts         WebAudio buses, sfx, generative music
    noise.ts         hash/value/fbm noise, rng, maths helpers
  game/
    worldgen.ts      the entire campus, built from primitives
    game.ts          renderer, loop, interaction, quests, save-less session
    store.ts         zustand store (UI + game state)
    story.ts         quest steps, dialogue, items
  ui/              # HUD, minimap, dialogue, journal, bag, pause, title
  styles/global.css  # design system
scripts/
  gentest.ts       headless world validator (timing + reachability)
  rayrender.ts     offline voxel raycaster used for visual QA
```

**Performance budget:** worldgen ≈ 60 ms · light bake ≈ 220 ms · all 64 chunk meshes ≈ 620 ms (once, during the loading screen). After that the frame is mostly a few hundred draw calls of static geometry at 60 fps.

### Tools

```bash
npm run typecheck            # tsc, strict, no emit
npm run build                # typecheck + production bundle
npx esbuild scripts/gentest.ts --bundle --platform=node --outfile=/tmp/gentest.mjs --format=esm \
  && node /tmp/gentest.mjs   # geometry, lighting, reachability, interact ranges

npx esbuild scripts/playtest.ts --bundle --platform=node --outfile=/tmp/playtest.mjs --format=esm \
  && node /tmp/playtest.mjs  # movement is camera-relative, jump height, wall collision, spawn safety
```

`gentest` builds the world, bakes light, meshes every chunk, then BFS-floods every standable cell from the spawn point and asserts that all 24 points of interest and all 25 NPCs are reachable — it is how the staircases were debugged. `gentest` also asserts that every point of interest and every NPC can be reached *and* is inside its exact in-game interaction radius, and `playtest` drives the real `Player` class against the real world and checks the walk direction against three.js' own camera basis.

---

Built with three.js, React, zustand and framer-motion. Every texture, sound and building is generated by code.
