import '@/style.css';
import { debugHook, installDebugHook, sampleLuma } from '@/core/DebugHook';
import { Loop } from '@/core/Loop';
import { Renderer } from '@/core/Renderer';
import { SceneRoot } from '@/core/SceneRoot';
import { Sim } from '@/core/Sim';
import { M4_SURFACES } from '@/fixtures/m4Track';
import { M5_FIXTURE_SETS } from '@/fixtures/m5Fixtures';
import { InputQueue } from '@/input/InputQueue';
import { attachKeyboard } from '@/input/KeyboardInput';
import { CharacterRig } from '@/core/CharacterRig';
import { UI } from '@/ui/UI';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found in index.html');

const sceneRoot = new SceneRoot();
const renderer = new Renderer(app, sceneRoot.camera);
const input = new InputQueue();
const fixtureName = new URLSearchParams(location.search).get('fixture') ?? 'default';
const useProcedural = fixtureName === 'procedural';
const obstacles = useProcedural ? [] : (M5_FIXTURE_SETS[fixtureName] ?? M5_FIXTURE_SETS.default);
const sim = new Sim(sceneRoot, input, obstacles, useProcedural);

if (!useProcedural) {
  sceneRoot.addStaticTrack(M4_SURFACES, obstacles);
}

CharacterRig.load()
  .then((rig) => {
    sceneRoot.attachCharacter(rig);
    debugHook.characterLoaded = true;
  })
  .catch((err) => console.error('CharacterRig load failed', err));

attachKeyboard(input);

function render(): void {
  renderer.render(sceneRoot.scene);
  debugHook.stats.frame++;
  if (debugHook.stats.frame % 30 === 0) sampleLuma(renderer.three);
  debugHook.stats.drawCalls = renderer.drawCalls;
  debugHook.stats.triangles = renderer.triangles;
  ui.update(debugHook);
}

const loop = new Loop(() => sim.tick(), render);

const ui = new UI(
  () => {
    sim.setSeed(Date.now());
    loop.setPaused(false);
  },
  () => location.reload(),
);

installDebugHook();
debugHook.seed = (n: number) => sim.setSeed(n);
debugHook.setPaused = (paused: boolean) => loop.setPaused(paused);
debugHook.step = (ticks: number) => loop.stepTicks(ticks);
debugHook.enqueue = (actions) => input.pushAll(actions);
debugHook.grantPowerUp = (type) => sim.grantPowerUp(type);
debugHook.spawnTestCoin = (x, y, z) => sim.spawnTestCoin(x, y, z);

loop.setPaused(true);
loop.start();
