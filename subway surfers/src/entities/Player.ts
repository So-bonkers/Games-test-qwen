import * as THREE from 'three';
import { PlayerState, Lane, RideTarget } from '@/types';
import {
  LANE_POSITIONS,
  LERP_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  FAST_FALL_SPEED,
  SLIDE_DURATION,
} from '@/core/GameConfig';
import { PlayerRig, NEUTRAL_POSE, lerpPose, smoothstep } from './PlayerRig';
import type { Pose } from './PlayerRig';
import { computePose } from './PlayerAnimations';

// ─── Animation clip names (matching Mixamo export conventions) ──
// Kept for a future offline asset import; the current build uses the
// procedural rig + pose system below.
export const ANIM_RUN = 'mixamorig:Run';
export const ANIM_JUMP = 'mixamorig:Jump';
export const ANIM_SLIDE = 'mixamorig:Slide';
export const ANIM_CRASH = 'mixamorig:Fall';

/** Crossfade duration between animation states (seconds). */
const TRANSITION_TIME = 0.18;
/** Run-cycle angular speed (radians/sec) at base game speed. */
const RUN_CYCLE_SPEED = 7.5;

/**
 * Player — the playable character.
 * Extends THREE.Group so its position is the world-space anchor.
 *
 * Phase 2 (redone): a stylized procedural character rig (PlayerRig) driven
 * by a pose-based animation state machine (PlayerAnimations):
 *   - Run cycle: opposite-phase legs with knee recovery, counter-swinging
 *     bent arms, hip bob, forward lean
 *   - Jump: tuck pose (knees up, arms out)
 *   - Slide: low body, legs stretched forward
 *   - Crash: backward tumble with flailing limbs
 *   - Jetpack / Idle: ready for Phases 6–7
 * All state changes crossfade (~0.18s) by blending the outgoing pose into
 * the incoming one — no hard snaps.
 */
export class Player extends THREE.Group {
  // ── Visual components ────────────────────────────────────────
  private readonly rig: PlayerRig;
  private readonly shadowBlob: THREE.Mesh;
  private readonly blobMaterial: THREE.MeshBasicMaterial;

  // ── Optional Mixamo path (future) ────────────────────────────
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<PlayerState, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private clipMap: Map<string, THREE.AnimationClip> = new Map();

  // ── State tracking ────────────────────────────────────────────
  private _state: PlayerState = PlayerState.Running;
  private _lane: Lane = Lane.Center;
  private _targetX = 0;
  private _velocityY = 0;
  private _isGrounded = true;
  private _slideTimer = 0;
  private _isSliding = false;
  private _isJetpacking = false;

  // ── Pose blending (crossfade) ────────────────────────────────
  private _poseFrom: Pose = { ...NEUTRAL_POSE };
  private _toState: PlayerState = PlayerState.Running;
  private _transitionT = 1; // 1 = fully settled in current state
  private _stateTime = 0;
  private _lastPose: Pose = { ...NEUTRAL_POSE };

  // ── Run cycle phase (radians) ────────────────────────────────
  private runPhase = 0;

  // ── Landing squash & stretch ─────────────────────────────────
  private _squash = 0;

  // ── Roof riding (ramp trains) ────────────────────────────────
  /** Set when jumping off a train roof so the snap-to-roof releases. */
  private _ridingDisabled = false;

  // ── Platform surface probe (injected by Game each frame) ─────
  /** Returns the walkable height at a world X position (0 or PLATFORM_HEIGHT). */
  private surfaceProbe: ((x: number) => number) | null = null;

  // ── Crash timer (auto-respawn placeholder until Phase 5) ─────
  private _crashTimer = 0;

  // ── Dive slam (slide pressed while airborne / on a roof) ─────
  /** True while slamming down fast; consumed on landing → quick slide entry. */
  private _diveSlam = false;
  /** Set each frame by update() — true while stuck to a ramp train's roof. */
  private _isRiding = false;

  // ── Fast transition boost (air↔ground combos) ────────────────
  /** Multiplier applied to the next crossfade (3 = ~0.06s snap). */
  private _transitionBoost = 1;
  private _transitionDuration = TRANSITION_TIME;

  constructor() {
    super();
    this.name = 'Player';

    // Character rig (built with the neutral standing pose)
    this.rig = new PlayerRig();
    this.add(this.rig);

    // Soft fake shadow blob — stays on the ground during jumps,
    // shrinks/fades with height for a cheap depth cue.
    const blobGeo = new THREE.CircleGeometry(0.45, 28);
    this.blobMaterial = new THREE.MeshBasicMaterial({
      color: 0x10131a,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.shadowBlob = new THREE.Mesh(blobGeo, this.blobMaterial);
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = 0.015;
    this.add(this.shadowBlob);

    // Start at the center lane, on the ground
    this.position.set(0, 0, 0);
  }

  // ── Animation System ─────────────────────────────────────────
  /**
   * Initialize the animation mixer with loaded clips.
   * Called after a Mixamo model is loaded via AssetManager (future).
   * The procedural rig is hidden when real clips take over.
   */
  public setAnimationClips(clips: THREE.AnimationClip[]): void {
    this.mixer = new THREE.AnimationMixer(this);
    clips.forEach((clip) => {
      this.clipMap.set(clip.name, clip);
    });

    // const enum workaround: Object.values doesn't work with const enums
    const allStates: PlayerState[] = [
      PlayerState.Running,
      PlayerState.Jumping,
      PlayerState.Sliding,
      PlayerState.Crashing,
      PlayerState.Jetpacking,
    ];

    for (const state of allStates) {
      const clipName = this.getClipNameForState(state);
      const clip = this.clipMap.get(clipName);
      if (clip) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, -1);
        this.actions.set(state, action);
      }
    }

    this.rig.visible = false; // real skinned model takes over
    this.playState(PlayerState.Running);
  }

  /** Map a PlayerState to the expected Mixamo animation clip name. */
  private getClipNameForState(state: PlayerState): string {
    switch (state) {
      case PlayerState.Running: return ANIM_RUN;
      case PlayerState.Jumping: return ANIM_JUMP;
      case PlayerState.Sliding: return ANIM_SLIDE;
      case PlayerState.Crashing: return ANIM_CRASH;
      default: return ANIM_RUN;
    }
  }

  /**
   * Transition to a new animation state.
   * Snapshots the current visual pose so the crossfade starts exactly
   * where the character is — even mid-cycle or mid-crash.
   */
  public playState(state: PlayerState): void {
    if (state === this._state) return;

    // Crossfade bookkeeping (boost lets air↔ground combos snap faster)
    this._poseFrom = { ...this._lastPose };
    this._toState = state;
    this._transitionT = 0;
    this._stateTime = 0;
    this._transitionDuration = TRANSITION_TIME / this._transitionBoost;
    this._transitionBoost = 1; // consumed

    const previousState = this._state;
    this._state = state;

    // Optional real-clip path (Mixamo, future)
    if (this.mixer) {
      const prevAction = this.actions.get(previousState);
      const newAction = this.actions.get(state);

      if (prevAction && newAction) {
        prevAction.fadeOut(0.15);
        newAction.reset().fadeIn(0.15).play();
        this.currentAction = newAction;
      } else if (newAction) {
        newAction.reset().fadeIn(0.15).play();
        this.currentAction = newAction;
      }
    }

    // Reset slide timer when entering sliding state
    if (state === PlayerState.Sliding) {
      this._slideTimer = SLIDE_DURATION;
      this._isSliding = true;
    } else {
      this._isSliding = false;
    }

    // Jetpack overrides gravity
    if (state === PlayerState.Jetpacking) {
      this._isJetpacking = true;
      this._velocityY = 0;
      this._isGrounded = false;
    } else {
      this._isJetpacking = false;
    }
  }

  /**
   * Per-frame update: pose blending, squash & stretch, shadow,
   * slide timer, vertical physics (platform-aware), roof riding,
   * platform collisions, and smooth lane transitions.
   *
   * @param ctx World context from the Spawner:
   *          - ride: ramp-train target — when overlapping, the player rides
   *            its roof instead of the lane ground.
   *          - surfaceAt(x): walkable height at world X (platform sections).
   */
  public update(
    delta: number,
    ctx?: { ride?: RideTarget | null; surfaceAt?: (x: number) => number },
  ): void {
    if (ctx?.surfaceAt) this.surfaceProbe = ctx.surfaceAt;
    const ride = ctx?.ride ?? null;
    // ── Advance state time & crossfade ──────────────────────────
    this._stateTime += delta;
    if (this._transitionT < 1) {
      this._transitionT = Math.min(1, this._transitionT + delta / this._transitionDuration);
    }

    // ── Run cycle phase (only while grounded & running) ────────
    if (this._state === PlayerState.Running && this._isGrounded) {
      this.runPhase += delta * RUN_CYCLE_SPEED;
    }

    // ── Compute blended pose & apply to the rig ────────────────
    if (!this.mixer) {
      const target = computePose(this._toState, this._stateTime, this.runPhase);
      const k = smoothstep(this._transitionT);
      const pose = lerpPose(this._poseFrom, target, k);

      // Lean the torso into lane changes (reads great from behind)
      const dx = this._targetX - this.position.x;
      if (Math.abs(dx) > 0.01 && !this._isJetpacking) {
        pose.torsoZ += THREE.MathUtils.clamp(-dx * 0.12, -0.38, 0.38);
      }

      this.rig.applyPose(pose);
      this._lastPose = pose;
    } else if (this.mixer) {
      this.mixer.update(delta);
    }

    // ── Slide timer ─────────────────────────────────────────────
    if (this._isSliding) {
      this._slideTimer -= delta;
      if (this._slideTimer <= 0) {
        this.playState(PlayerState.Running);
      }
    }

    // ── Ground level: outer lanes elevated ONLY inside platform sections ──
    const laneGround = this.surfaceProbe
      ? this.surfaceProbe(LANE_POSITIONS[this._lane])
      : 0;

    // ── Roof riding (ramp trains) ──────────────────────────────
    let groundY = laneGround;
    let riding = false;
    if (ride && Math.abs(this.position.x - ride.x) < 1.5) {
      const d = -ride.frontZ; // distance from train front to player (player at Z=0)
      const total = ride.rearZ - ride.frontZ;
      if (d >= 0 && d <= total) {
        if (!this._ridingDisabled) {
          riding = true;
          // On the ramp: climb the slope. Past it: level on the roof.
          groundY = d < ride.rampLength
            ? laneGround + (ride.roofY - laneGround) * (d / ride.rampLength)
            : ride.roofY;
        }
      } else {
        this._ridingDisabled = false; // train passed — re-arm riding
      }
    } else {
      this._ridingDisabled = false;
    }

    // ── Vertical physics (jump / gravity) ───────────────────────
    const wasGrounded = this._isGrounded;
    this._isRiding = riding;
    if (riding) {
      // Stick to the train surface (fast follow), treat as grounded
      this.position.y += (groundY - this.position.y) * Math.min(1, delta * 20);
      this._velocityY = 0;
      this._isGrounded = true;
    } else if (!this._isGrounded && !this._isJetpacking) {
      this._velocityY += GRAVITY * delta;
      this.position.y += this._velocityY * delta;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this._velocityY = 0;
        this._isGrounded = true;

        if (this._diveSlam) {
          // Dive slam landed — snap into the slide with a very fast transition
          this._diveSlam = false;
          this._transitionBoost = 3;
          this.playState(PlayerState.Sliding);
        } else if (this._state !== PlayerState.Running && this._state !== PlayerState.Crashing) {
          // Return to the run cycle on landing (always — not just with clips)
          this.playState(PlayerState.Running);
        }
      }
    } else if (!this._isJetpacking) {
      // Grounded: ease toward the lane's ground level — smooth step
      // up/down when switching between track and platforms
      this.position.y += (groundY - this.position.y) * Math.min(1, delta * 14);
    }

    // ── Platform collision rule ────────────────────────────────
    // Being in an outer lane at track level while a deck section is here
    // means you walked into its solid face — you had to JUMP first and
    // land on top. (Center lane is always open, so this never fires there.)
    if (this._state !== PlayerState.Crashing && this.surfaceProbe) {
      const top = this.surfaceProbe(LANE_POSITIONS[this._lane]);
      if (top > 0.3 && this.position.y < top - 0.35) {
        this.crash();
      }
    }

    // ── Crash handling: play the fall, then respawn ─────────────
    // (Placeholder loop until Phase 5 adds score + game-over screen)
    if (this._state === PlayerState.Crashing) {
      this._crashTimer += delta;
      if (this._crashTimer > 1.4) this.reset();
    }

    // ── Landing squash & stretch ────────────────────────────────
    if (!wasGrounded && this._isGrounded && this._squash === 0) {
      this._squash = 1;
    }
    this._squash = Math.max(0, this._squash - delta * 4.5);
    const sq = this._squash;
    this.rig.scale.set(1 + 0.16 * sq, 1 - 0.22 * sq, 1 + 0.16 * sq);

    // ── Shadow blob: stay on the current surface (track, platform,
    //    or train roof), shrink with height above it ────────────
    const h = Math.max(0, this.position.y - groundY);
    this.shadowBlob.position.y = groundY + 0.015 - this.position.y;
    const s = THREE.MathUtils.clamp(1 - h * 0.09, 0.35, 1);
    this.shadowBlob.scale.setScalar(s);
    this.blobMaterial.opacity = 0.3 * THREE.MathUtils.clamp(1 - h * 0.12, 0.2, 1);

    // ── Smooth lane transition (lerp) ───────────────────────────
    if (!this._isJetpacking) {
      const factor = Math.min(LERP_SPEED * delta, 1);
      this.position.x += (this._targetX - this.position.x) * factor;
    }
  }

  // ── Physics & Movement ────────────────────────────────────────
  public jump(): void {
    if (this._state === PlayerState.Crashing) return;
    if (!this._isGrounded) return;

    // Jumping OUT of a slide — quick pop-up transition (mirrors the dive slam)
    if (this._isSliding) this._transitionBoost = 3;

    // Releasing the roof (if riding a ramp train) so we can fly off it
    this._ridingDisabled = true;
    this._velocityY = JUMP_VELOCITY;
    this._isGrounded = false;
    this.playState(PlayerState.Jumping);
  }

  public slide(): void {
    if (this._isSliding || this._state === PlayerState.Crashing) return;

    if (!this._isGrounded || this._isRiding) {
      // DIVE SLAM — pressed down while airborne (or on a train roof):
      // slam to the surface fast, then snap into the slide on landing.
      this._velocityY = Math.min(this._velocityY, -FAST_FALL_SPEED);
      this._diveSlam = true;
      this._ridingDisabled = true; // releases the roof ride too
      return;
    }

    this.playState(PlayerState.Sliding);
  }

  public crash(): void {
    if (this._state === PlayerState.Crashing) return;
    this.playState(PlayerState.Crashing);
    this._velocityY = 0;
    this._isGrounded = true;
    this.position.y = 0;
    this._crashTimer = 0;
    this._diveSlam = false;
  }

  /** Full reset for a new run. */
  public reset(): void {
    this._state = PlayerState.Running;
    this._lane = Lane.Center;
    this._targetX = 0;
    this._velocityY = 0;
    this._isGrounded = true;
    this._isSliding = false;
    this._isJetpacking = false;

    this.position.set(0, 0, 0);
    this.scale.set(1, 1, 1);
    this.rig.scale.set(1, 1, 1);
    this.runPhase = 0;
    this._squash = 0;
    this._ridingDisabled = false;
    this._crashTimer = 0;
    this._diveSlam = false;
    this._transitionBoost = 1;
    this._transitionDuration = TRANSITION_TIME;

    // Settle the pose system back to a clean standing run start
    this._poseFrom = { ...NEUTRAL_POSE };
    this._toState = PlayerState.Running;
    this._transitionT = 1;
    this._stateTime = 0;
    this._lastPose = { ...NEUTRAL_POSE };
    this.rig.resetPose();

    if (this.mixer) {
      const runAction = this.actions.get(PlayerState.Running);
      if (runAction) {
        runAction.reset().play();
        this.currentAction = runAction;
      }
    }
  }

  public switchLane(direction: 'left' | 'right'): void {
    const currentLaneIndex = this._lane;
    let newLaneIndex: number;

    // NOTE — screen mapping: the camera sits at Z=-9 looking toward +Z, so
    // world +X appears on SCREEN-LEFT and world -X on SCREEN-RIGHT.
    // Lane 0 is X=-3 (screen right), lane 2 is X=+3 (screen left).
    // Therefore "left" must move the index UP (toward +3) and "right" DOWN.
    if (direction === 'left') {
      newLaneIndex = Math.min(2, currentLaneIndex + 1);
    } else {
      newLaneIndex = Math.max(0, currentLaneIndex - 1);
    }

    this._lane = newLaneIndex as Lane;
    this._targetX = LANE_POSITIONS[newLaneIndex];
    console.log(`[Player] switchLane(${direction}): lane ${currentLaneIndex}→${newLaneIndex}, X: ${this.position.x.toFixed(2)} → target=${this._targetX}`);
  }

  // ── Resource management ───────────────────────────────────────
  public dispose(): void {
    this.rig.dispose();
    this.shadowBlob.geometry.dispose();
    this.blobMaterial.dispose();
  }

  // ── Getters/Setters ──────────────────────────────────────────
  public get state(): PlayerState { return this._state; }
  public get lane(): Lane { return this._lane; }
  public get isGrounded(): boolean { return this._isGrounded; }
  public get isSliding(): boolean { return this._isSliding; }
  public get isJetpacking(): boolean { return this._isJetpacking; }
  public get targetX(): number { return this._targetX; } // For debug overlay
}
