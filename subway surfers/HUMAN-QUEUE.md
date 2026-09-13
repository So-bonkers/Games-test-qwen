# Human Queue

Tasks that require a human. The executor (local model via dsh) never performs these, never waits on them, and never reports progress about them.

Only **M8** depends on anything here. Every other milestone runs unattended.

---

## 1. Mixamo pre-flight — blocks M8, start now

Requires an Adobe account. Download to `public/models/`:

- [ ] Character model, GLB, T-pose, **with skin**
- [ ] Clip: run (looping)
- [ ] Clip: jump
- [ ] Clip: slide / roll
- [ ] Clip: land
- [ ] Clip: crash / stumble

Export settings: **FBX for Unity (.fbx)** → convert to GLB, or use Mixamo's GLB export where available. Skeleton must be identical across all clips — download the character once, then each animation "with skin" off so clips share one rig.

Name files exactly: `character.glb`, `anim-run.glb`, `anim-jump.glb`, `anim-slide.glb`, `anim-land.glb`, `anim-crash.glb`.

When done, tick this box and tell Claude — M8's microplan is written against the real files on disk, so it cannot be generated until they exist.

- [ ] **Done**

---

## 2. Audio selection — blocks M9's audio tasks only

Drop files in `public/audio/`. Sources: Kenney audio packs (CC0), Freesound (check per-sound license), Pixabay Music.

- [ ] `music-loop.mp3` — synthwave / cyberpunk
- [ ] `sfx-jump.mp3`
- [ ] `sfx-land.mp3`
- [ ] `sfx-coin.mp3`
- [ ] `sfx-crash.mp3`
- [ ] `sfx-hoverboard.mp3`

---

## 3. Licensing decision

- [ ] Is this project ever going to be distributed commercially?
- [ ] If any asset is CC-BY rather than CC0, a credits screen becomes mandatory. Decide before M9 so the UI accounts for it.

Mixamo assets are royalty-free for commercial use under the Adobe license but **cannot be redistributed as raw asset files** — fine for a shipped game, not fine for committing the GLBs to a public repo. If this repo goes public, add `public/models/` to `.gitignore` and document the download steps instead.

---

## Review checkpoints

Batched deliberately — four sessions total, so review does not interrupt unattended execution.

| After | What only you can judge | Checklist |
|---|---|---|
| M3 | Movement feel | Jump arc height/duration; lane-switch snappiness; does fast-fall feel responsive |
| M6 | Difficulty | Does the ramp feel fair; are accelerating trains readable in time; any cheap deaths |
| M9 | UI + audio | Is the HUD legible at speed; is the mix balanced; is game-over→restart friction-free |
| M11 | Art direction | Does the halftone/chromatic-aberration look actually read as Spider-Verse, or just noisy |

Everything else is gated by `npm run gate` and needs no human.
