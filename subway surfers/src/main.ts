import '@/style.css';
import { PLAYER_HEIGHT } from '@/core/GameConfig';
import { debugHook, installDebugHook, sampleLuma } from '@/core/DebugHook';
import { Loop } from '@/core/Loop';
import { Renderer } from '@/core/Renderer';
import { SceneRoot } from '@/core/SceneRoot';
import { Sim } from '@/core/Sim';
import { InputQueue } from '@/input/InputQueue';
import { attachKeyboard } from '@/input/KeyboardInput';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found in index.html');

const sceneRoot = new SceneRoot();
const renderer = new Renderer(app, sceneRoot.camera);
const input = new InputQueue();
const sim = new Sim(sceneRoot, input);

attachKeyboard(input);

function render(): void {
  renderer.render(sceneRoot.scene);
  debugHook.stats.frame++;
  if (debugHook.stats.frame % 30 === 0) sampleLuma(renderer.three);
  debugHook.stats.drawCalls = renderer.drawCalls;
  debugHook.stats.triangles = renderer.triangles;
  debugHook.player.feetY = sceneRoot.placeholder.position.y - PLAYER_HEIGHT / 2;
}

const loop = new Loop(() => sim.tick(), render);

installDebugHook();
debugHook.seed = (n: number) => sim.setSeed(n);
debugHook.setPaused = (paused: boolean) => loop.setPaused(paused);
debugHook.step = (ticks: number) => loop.stepTicks(ticks);
debugHook.enqueue = (actions) => input.pushAll(actions);

loop.start();
