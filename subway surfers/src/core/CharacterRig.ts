import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ANIM_CROSSFADE_SECONDS, CHARACTER_SCALE } from '@/core/GameConfig';
import type { AnimState } from '@/contracts/character';
import type { ObstacleType } from '@/contracts/obstacle';

const CLIP_FILES: Record<AnimState, string> = {
  RUN: 'anim-run.fbx',
  JUMP: 'anim-jump.fbx',
  SLIDE: 'anim-slide.fbx',
  LAND: 'anim-land.fbx',
  CRASH_LEGS: 'anim-crash-legs.fbx',
  CRASH_TRIP: 'anim-crash-trip.fbx',
  CRASH_FALL: 'anim-crash-fall.fbx',
};

export const CRASH_CLIP_BY_OBSTACLE_TYPE: Record<ObstacleType, AnimState> = {
  LOW_BARRIER: 'CRASH_LEGS',
  PLATFORM: 'CRASH_LEGS',
  HIGH_BARRIER: 'CRASH_TRIP',
  RAMP_TRAIN: 'CRASH_TRIP',
  FULL_BLOCK: 'CRASH_FALL',
  TRAIN: 'CRASH_FALL',
};

export class CharacterRig {
  readonly group: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<AnimState, THREE.AnimationAction>;
  private currentState: AnimState | null = null;

  private constructor(
    group: THREE.Object3D,
    mixer: THREE.AnimationMixer,
    actions: Record<AnimState, THREE.AnimationAction>,
  ) {
    this.group = group;
    this.mixer = mixer;
    this.actions = actions;
  }

  static async load(): Promise<CharacterRig> {
    const loader = new FBXLoader();
    const character = await loader.loadAsync('/models/character.fbx');
    character.scale.setScalar(CHARACTER_SCALE);

    const mixer = new THREE.AnimationMixer(character);
    const actions = {} as Record<AnimState, THREE.AnimationAction>;

    for (const state of Object.keys(CLIP_FILES) as AnimState[]) {
      const clipObject = await loader.loadAsync(`/models/${CLIP_FILES[state]}`);
      const clip = clipObject.animations[0];
      actions[state] = mixer.clipAction(clip);
    }

    return new CharacterRig(character, mixer, actions);
  }

  setState(state: AnimState): void {
    if (state === this.currentState) return;
    const next = this.actions[state];
    const prev = this.currentState ? this.actions[this.currentState] : null;

    next.reset();
    next.setLoop(state === 'RUN' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = state !== 'RUN';
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (prev) next.crossFadeFrom(prev, ANIM_CROSSFADE_SECONDS, false);

    this.currentState = state;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
