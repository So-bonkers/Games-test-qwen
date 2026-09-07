import { PlayerState } from '@/types';
import type { Pose } from './PlayerRig';

// ─── Helpers ───────────────────────────────────────────────────
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Compute the target joint pose for a given player state.
 *
 * @param state     The animation state to pose for.
 * @param t         Time spent in this state (seconds) — drives one-shot
 *                  animations (jump tuck, crash fall) and idle wobble.
 * @param runPhase  Continuous run-cycle phase in radians (advanced by Player
 *                  while grounded & running). Only used by the Running pose.
 */
export function computePose(state: PlayerState, t: number, runPhase: number): Pose {
  switch (state) {
    case PlayerState.Running:
      return runPose(runPhase);
    case PlayerState.Jumping:
      return jumpPose(t);
    case PlayerState.Sliding:
      return slidePose(t);
    case PlayerState.Crashing:
      return crashPose(t);
    case PlayerState.Jetpacking:
      return jetpackPose(t);
    default:
      return idlePose(t);
  }
}

// ─── Run cycle ─────────────────────────────────────────────────
/**
 * Full-body run cycle driven by a continuous phase:
 *  - legs swing in opposite phase; the back leg bends its knee on recovery
 *  - arms counter-swing with bent elbows
 *  - hips bob at foot-strike frequency, torso leans forward with a light sway
 */
function runPose(p: number): Pose {
  const s = Math.sin(p);
  return {
    // Hips bob once per stride (|sin| peaks at each foot strike)
    hipsY: 0.92 + Math.abs(s) * 0.055,

    // Forward lean with a subtle counter-sway
    torsoX: 0.17 - s * 0.03,
    torsoZ: s * 0.045,
    headX: -0.06,

    // Arms counter-swing opposite the same-side leg; elbows stay bent
    shLx: s * 0.8, shLz: 0.14, elL: 0.72 + 0.22 * s,
    shRx: -s * 0.8, shRz: -0.14, elR: 0.72 - 0.22 * s,

    // Legs: opposite swing; knee bends while the leg is behind (recovery)
    hipLx: -s * 0.95, hipLz: 0.05, kneeL: 0.12 + Math.max(0, -s) * 0.95,
    hipRx: s * 0.95, hipRz: -0.05, kneeR: 0.12 + Math.max(0, s) * 0.95,
  };
}

// ─── Jump (arms overhead, knees up) ────────────────────────────
function jumpPose(t: number): Pose {
  const u = easeOutCubic(clamp01(t * 4.5)); // quick settle into the pose
  return {
    hipsY: 0.97,

    // Slight arch back, head up to "look at" the obstacle
    torsoX: -0.22 * u,
    torsoZ: 0,
    headX: -0.38 * u,

    // Arms OUT and IN — upper arms raised wide to the sides (hands out),
    // forearms folded back toward head height (hands in): a dynamic
    // "wings up" jump pose instead of straight-overhead arms
    shLx: 2.9 * u, shLz: 1.1 * u, elL: 0.85 * u,
    shRx: 2.9 * u, shRz: -1.1 * u, elR: 0.85 * u,

    // Knees tucked up (asymmetric for style)
    hipLx: -1.2 * u, hipLz: 0.08 * u, kneeL: 1.55 * u,
    hipRx: -0.9 * u, hipRz: -0.06 * u, kneeR: 1.25 * u,
  };
}

// ─── Slide (low body, legs out front) ──────────────────────────
function slidePose(t: number): Pose {
  const u = easeOutCubic(clamp01(t * 8)); // fast entry into the slide
  return {
    hipsY: 0.45,

    // Lean back, chin up
    torsoX: 0.78 * u,
    torsoZ: 0.06 * u,
    headX: -0.32 * u,

    // Arms trail behind for balance
    shLx: 0.95 * u, shLz: 0.55 * u, elL: 1.15 * u,
    shRx: 0.75 * u, shRz: -0.45 * u, elR: 1.25 * u,

    // Legs stretched out in front, nearly straight
    hipLx: -1.95 * u, hipLz: 0.1 * u, kneeL: 0.35 * u,
    hipRx: -1.8 * u, hipRz: -0.1 * u, kneeR: 0.5 * u,
  };
}

// ─── Crash (tumble backward with flailing limbs) ───────────────
function crashPose(t: number): Pose {
  const fall = easeOutCubic(clamp01(t * 2.6)); // ~0.4s to hit the ground
  return {
    hipsY: 0.92 - 0.58 * fall,

    // Fall backward (toward camera) until lying down
    torsoX: 2.0 * fall,
    torsoZ: 0.15 * fall,
    headX: -0.55 * fall,

    // Arms flail up with a little wobble
    shLx: 2.5 * fall + Math.sin(t * 14) * 0.12, shLz: 0.75 * fall, elL: 0.35,
    shRx: 2.7 * fall + Math.cos(t * 12) * 0.12, shRz: -0.75 * fall, elR: 0.4,

    // Legs kick forward and up as the body falls
    hipLx: -1.25 * fall, hipLz: 0.12 * fall, kneeL: 0.85 * fall,
    hipRx: -1.05 * fall, hipRz: -0.1 * fall, kneeR: 0.95 * fall,
  };
}

// ─── Jetpack (hovering, arms out) ──────────────────────────────
function jetpackPose(t: number): Pose {
  const bob = Math.sin(t * 5) * 0.06;
  return {
    hipsY: 0.98 + bob * 0.3,

    torsoX: -0.12,
    torsoZ: 0,
    headX: -0.25, // looking up at the sky

    // Arms wide for "flying"
    shLx: -0.2, shLz: 1.35 + Math.sin(t * 6) * 0.08, elL: 0.45,
    shRx: -0.2, shRz: -1.35 - Math.cos(t * 6) * 0.08, elR: 0.45,

    // Legs hang with a slight forward kick
    hipLx: -0.55, hipLz: 0.08, kneeL: 0.75,
    hipRx: -0.4, hipRz: -0.06, kneeR: 0.6,
  };
}

// ─── Idle (menu / breathing) ───────────────────────────────────
function idlePose(t: number): Pose {
  const breath = Math.sin(t * 1.7);
  return {
    hipsY: 0.92 + breath * 0.012,

    torsoX: 0.04 + breath * 0.02,
    torsoZ: 0,
    headX: -0.03,

    // Relaxed arms, slight sway
    shLx: 0.05 + breath * 0.02, shLz: 0.16, elL: 0.2,
    shRx: 0.05 - breath * 0.02, shRz: -0.16, elR: 0.2,

    // Weighted stance
    hipLx: 0.03, hipLz: 0.08, kneeL: 0.1,
    hipRx: 0.03, hipRz: -0.08, kneeR: 0.1,
  };
}
