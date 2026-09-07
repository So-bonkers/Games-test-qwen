import * as THREE from 'three';
import { GameState } from '@/types';
import { Player } from '@/entities/Player';
import { InputSystem } from '@/input/InputSystem';
import { Spawner } from '@/systems/Spawner';
import {
  CAMERA_POSITION,
  CAMERA_TARGET,
  SKY_COLOR,
  GROUND_COLOR,
  FOG_COLOR,
  FOG_NEAR,
  FOG_FAR,
  BASE_SPEED,
  LERP_SPEED,
} from './GameConfig';

// ─── Canvas Texture Generator ──────────────────────────────────
/**
 * Generates a scrolling THREE-TRACK railway texture on an off-screen canvas.
 * Brown/yellow color scheme: warm tan ballast, brown wooden sleepers,
 * gold rails — one clearly separated track bed per lane (no road markings).
 */
function createGroundTexture(size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // ── Base: warm tan ballast (yellow-brown scheme) ────────────
  ctx.fillStyle = '#bfa055';
  ctx.fillRect(0, 0, size, size);

  // Gravel speckle noise (sandy-yellow → warm brown variation)
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const t = Math.random();
    const r = Math.floor(150 + t * 60); // 150–210
    const g = Math.floor(118 + t * 45); // 118–163
    const b = Math.floor(58 + t * 30);  // 58–88
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Track centers in texture space. The ground plane is 20 units wide and
  // lanes sit at world X = -3 / 0 / +3 → u = 0.35 / 0.50 / 0.65.
  const trackCenters = [0.35, 0.5, 0.65];
  const railOffset = 0.045;  // half gauge (fraction of texture width)
  const sleeperHalf = 0.068; // sleeper half-width

  // ── Darker grooves between the three track beds ─────────────
  ctx.fillStyle = 'rgba(90, 66, 30, 0.55)';
  for (const gx of [0.425, 0.575]) {
    ctx.fillRect(gx * size - 5, 0, 10, size);
  }

  // ── Per track: brown sleepers, then gold rails on top ───────
  const sleeperColor = '#7a4a26';
  const sleeperDark = '#5d381e';
  const sleeperHeight = 9;
  const sleeperSpacing = 18;

  for (const c of trackCenters) {
    const cx = c * size;
    const bandLeft = cx - sleeperHalf * size;
    const bandWidth = sleeperHalf * 2 * size;

    // Sleepers (wooden cross-pieces spanning this track bed only)
    for (let y = 0; y < size; y += sleeperSpacing) {
      ctx.fillStyle = sleeperColor;
      ctx.fillRect(bandLeft, y, bandWidth, sleeperHeight);

      // Darker bottom edge for depth
      ctx.fillStyle = sleeperDark;
      ctx.fillRect(bandLeft, y + sleeperHeight - 2, bandWidth, 2);

      // Wood grain streaks
      for (let gx = bandLeft; gx < bandLeft + bandWidth; gx += 10) {
        ctx.fillStyle = `rgba(40,22,8,${0.06 + Math.random() * 0.08})`;
        ctx.fillRect(gx, y + 1, 3, sleeperHeight - 2);
      }
    }

    // Rails: dark seat → gold body → bright highlight
    for (const side of [-1, 1]) {
      const rx = cx + side * railOffset * size;
      ctx.fillStyle = '#7c5e14'; // rail seat shadow
      ctx.fillRect(rx - 3.5, 0, 7, size);
      ctx.fillStyle = '#f2c94c'; // gold rail body
      ctx.fillRect(rx - 2, 0, 4, size);
      ctx.fillStyle = '#ffe08a'; // highlight line
      ctx.fillRect(rx - 0.5 + side * 1.2, 0, 1.2, size);
    }
  }

  // ── Outer edge warning stripes (yellow) ─────────────────────
  ctx.fillStyle = 'rgba(217, 165, 33, 0.65)';
  ctx.fillRect(3, 0, 4, size);
  ctx.fillRect(size - 7, 0, 4, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 8);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates a sky gradient texture for the background.
 */
function createSkyTexture(size: number = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const t = y / size; // 0 = bottom, 1 = top
    // Gradient: light blue at horizon → deeper blue at zenith
    const r = Math.floor(135 + t * 40);   // 135 → 175
    const g = Math.floor(206 + t * 29);   // 206 → 235
    const b = Math.floor(235 + t * 20);   // 235 → 255
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Game — the central controller managing the Three.js scene,
 * camera, renderer, ground scrolling, and game loop.
 */
export class Game {
  public readonly container: HTMLElement;

  // ── Three.js core ───────────────────────────────────────────
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  // ── Scene objects ───────────────────────────────────────────
  private ground!: THREE.Mesh;
  private groundTexture!: THREE.CanvasTexture;
  private leftWall!: THREE.Mesh;
  private rightWall!: THREE.Mesh;

  // Player entity
  private player!: Player;

  // Phase 4 — procedural obstacles, coins, tunnels & platform sections
  private spawner!: Spawner;

  // Error overlay — shows if anything goes wrong during init
  private errorOverlay!: HTMLDivElement;

  // Input system
  private inputSystem!: InputSystem;

  // ── Game state ──────────────────────────────────────────────
  private gameState: GameState = 'menu';
  private clock!: THREE.Clock;
  private isRunning = false;

  // World movement (everything scrolls toward the player)
  private _worldSpeed = BASE_SPEED;      // units/sec
  private _distanceTraveled = 0;         // total meters traveled

  // ── Debug overlay ───────────────────────────────────────────
  private debugEl!: HTMLDivElement;
  private fpsFrames = 0;
  private currentFps = 0;
  private lastFpsTime = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  // ── Initialization ──────────────────────────────────────────
  private init(): void {
    console.log('[Game] Initializing...');

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    console.log('[Game] Scene created, background:', SKY_COLOR.toString(16));

    // Camera — fixed behind-and-above the player (Subway Surfers style)
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
    this.camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
    console.log('[Game] Camera pos:', this.camera.position);

    // Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = false;
      console.log('[Game] Renderer created, canvas:', this.renderer.domElement);
    } catch (err) {
      console.error('[Game] WebGLRenderer failed:', err);
      throw err;
    }

    this.container.appendChild(this.renderer.domElement);
    console.log('[Game] Canvas appended to container');

    // Lighting — bright outdoor feel
    this.setupLighting();
    console.log('[Game] Lighting set up');

    // Scrolling ground with lane texture
    this.setupGround();
    console.log('[Game] Ground set up');

    // Side walls/curbs for depth perception
    this.setupWalls();
    console.log('[Game] Walls set up');

    // Platform sections (limited stretches on outer lanes) are spawned
    // by the Spawner — see spawnerRef.

    // Player entity (fixed at Z=0, world scrolls toward them)
    this.player = new Player();
    this.scene.add(this.player);
    console.log('[Game] Player added to scene at:', this.player.position);

    // Phase 4 — procedural obstacle/coin spawner (pooled + recycled)
    this.spawner = new Spawner(this.scene);
    this.spawner.reset();
    console.log('[Game] Spawner ready');

    // Input system — wires keyboard + touch to player actions
    this.inputSystem = new InputSystem();
    this.setupInputHandlers();
    console.log('[Game] Input system ready');

    // Clock
    this.clock = new THREE.Clock();
    this.lastFpsTime = performance.now();

    // Debug overlay (HTML HUD) — shows live debug info
    this.setupDebugOverlay();

    // Lane indicator overlay — shows which lane the player is on with big colored bars
    this.setupLaneIndicator();

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    // Prevent overscroll / bounce on mobile
    document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    console.log('[Game] Init complete. Rendering:', this.renderer.info.render);
  }

  private setupLighting(): void {
    // Soft ambient fill
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    // Main sun light from above-front
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(3, 20, 15);
    this.scene.add(sun);

    // Subtle fill light from behind (rim)
    const rim = new THREE.DirectionalLight(0x88aaff, 0.3);
    rim.position.set(-5, 10, -10);
    this.scene.add(rim);
  }

  private setupGround(): void {
    try {
      // Generate the scrolling texture (lane dividers, noise, curbs)
      this.groundTexture = createGroundTexture(512);
    } catch (err) {
      console.error('[Game] Failed to create ground texture:', err);
      this.showWebGLError();
      return;
    }

    // Ground plane — large enough to cover the visible track area
    const groundGeo = new THREE.PlaneGeometry(20, 400);
    const groundMat = new THREE.MeshLambertMaterial({ map: this.groundTexture });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.z = 150; // Extends far forward
    this.scene.add(this.ground);

    // Motion cue comes from the scrolling sleeper/rail texture itself —
    // no concrete slabs or road dashes (those read as a road, not tracks).
  }

  private setupWalls(): void {
    // Left wall (warm brown trackside barrier)
    const wallGeo = new THREE.BoxGeometry(1.5, 1.2, 400);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });

    this.leftWall = new THREE.Mesh(wallGeo, wallMat);
    this.leftWall.position.set(-6.5, 0.6, 150);
    this.scene.add(this.leftWall);

    // Right wall (slightly darker brown for variation)
    this.rightWall = new THREE.Mesh(wallGeo, wallMat.clone());
    const rwMat = this.rightWall.material as THREE.MeshLambertMaterial;
    rwMat.color.set(0x5d3f28);
    this.rightWall.position.set(6.5, 0.6, 150);
    this.scene.add(this.rightWall);

    // Curb strips — warning-yellow edge lines on the ground
    const curbGeo = new THREE.PlaneGeometry(0.4, 400);
    const leftCurbMat = new THREE.MeshLambertMaterial({ color: 0xd9a521 });
    const rightCurbMat = new THREE.MeshLambertMaterial({ color: 0xc9961c });

    const leftCurb = new THREE.Mesh(curbGeo, leftCurbMat);
    leftCurb.rotation.x = -Math.PI / 2;
    leftCurb.position.set(-5.5, 0.02, 150);
    this.scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, rightCurbMat);
    rightCurb.rotation.x = -Math.PI / 2;
    rightCurb.position.set(5.5, 0.02, 150);
    this.scene.add(rightCurb);
  }

  private setupDebugOverlay(): void {
    this.debugEl = document.createElement('div');
    Object.assign(this.debugEl.style, {
      position: 'absolute',
      top: '8px',
      left: '8px',
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.55)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.6',
      pointerEvents: 'none',
      zIndex: '100',
      borderRadius: '4px',
    });
    this.debugEl.textContent = `FPS: -- | State: menu | Lane: C`;
    this.container.appendChild(this.debugEl);

    // ── WebGL context check ───────────────────────────────────
    const canvasEl = this.renderer.domElement as HTMLCanvasElement;
    let gl: unknown = null;
    try { gl = canvasEl.getContext('webgl2'); } catch {}
    if (!gl) { try { gl = canvasEl.getContext('webgl'); } catch {} }
    if (!gl) { try { gl = canvasEl.getContext('experimental-webgl'); } catch {} }

    if (!gl) {
      this.showWebGLError();
      return; // Stop initialization — nothing will render without WebGL
    }

    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    const debugInfo = isWebGL2 ? 'WebGL2' : 'WebGL1';
    console.log('[Game]', debugInfo, 'context acquired');

    try {
      const webgl = gl as WebGLRenderingContext;
      const ext = webgl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = webgl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        const vendor = webgl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        console.log('[Game] GPU:', renderer, `(${vendor})`);
      }
    } catch {}

    if (canvasEl.width === 0 || canvasEl.height === 0) {
      console.warn('[Game] Canvas has 0 dimensions, forcing resize...');
      this.onResize();
    }
  }

  private laneIndicatorEl!: HTMLDivElement;
  private setupLaneIndicator(): void {
    // Big colored bar at bottom showing current lane position
    this.laneIndicatorEl = document.createElement('div');
    Object.assign(this.laneIndicatorEl.style, {
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 24px',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '8px',
      pointerEvents: 'none',
      zIndex: '200',
      whiteSpace: 'nowrap',
    });
    this.container.appendChild(this.laneIndicatorEl);
  }

  private showWebGLError(): void {
    console.error('[Game] WebGL NOT available!');
    this.errorOverlay = document.createElement('div');
    Object.assign(this.errorOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      padding: '30px 40px', background: '#2a0000', color: '#ff6b6b',
      fontFamily: 'monospace', fontSize: '15px', border: '3px solid #f00',
      borderRadius: '12px', textAlign: 'center', zIndex: '9999', maxWidth: '80vw',
      lineHeight: '1.8', boxShadow: '0 0 40px rgba(255,0,0,0.3)',
    });

    const browser = navigator.userAgent.includes('Firefox') ? 'Firefox' :
                    navigator.userAgent.includes('Chrome') ? 'Chrome/Edge' :
                    navigator.userAgent.includes('Safari') ? 'Safari' : 'your browser';

    this.errorOverlay.innerHTML = `
      <div style="font-size:28px;margin-bottom:10px">🚫</div>
      <strong>WebGL Not Available</strong><br><br>
      The game requires WebGL to render.<br>
      You're using <strong>${browser}</strong>.<br><br>
      Please try:<br>
      • <strong>Google Chrome</strong> or <strong>Mozilla Firefox</strong><br>
      • Make sure hardware acceleration is enabled<br>
      • Check your browser's GPU settings
    `;

    this.container.appendChild(this.errorOverlay);
  }

  // ─── Input Handlers ──────────────────────────────────────────
  private setupInputHandlers(): void {
    this.inputSystem.subscribe((event) => {
      console.log(`[Input] Event: ${event.type}`);
      switch (event.type) {
        case 'left':
          this.player.switchLane('left');
          console.log(`[Game] Lane → left (screen-left), new X target: ${this.player.position.x.toFixed(2)} → moving toward +3`);
          break;
        case 'right':
          this.player.switchLane('right');
          console.log(`[Game] Lane → right (screen-right), new X target: ${this.player.position.x.toFixed(2)} → moving toward -3`);
          break;
        case 'up':
          this.player.jump();
          console.log(`[Game] Jump!`);
          break;
        case 'down':
          this.player.slide();
          console.log(`[Game] Slide!`);
          break;
      }
    });
  }

  // ── Game Loop ───────────────────────────────────────────────
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap at 100ms
    this.update(delta);
    this.render();
    this.updateDebugOverlay();
  };

  private update(delta: number): void {
    // ── Player Update (roof-ride + platform surface context) ───
    const ride = this.spawner.getRideTarget(this.player.position.x);
    this.player.update(delta, {
      ride,
      surfaceAt: (x: number) => this.spawner.platformTopAt(x, 0),
    });

    // ── Phase 4: spawn/scroll/recycle all world content ────────
    this.spawner.update(delta, this._worldSpeed);

    // ── Camera Follow (smooth X tracking) ──────────────────────
    const cameraTargetX = THREE.MathUtils.lerp(
      this.camera.position.x,
      this.player.position.x * 0.4, // Subtle follow for dynamic feel
      Math.min(LERP_SPEED * delta * 0.5, 1)
    );
    this.camera.position.x += (cameraTargetX - this.camera.position.x) * 0.08;

    // ── World Movement (everything scrolls toward player) ─────
    const scrollDistance = this._worldSpeed * delta;
    this._distanceTraveled += scrollDistance;

    // Delegate all world movement to moveWorldObjects
    this.moveWorldObjects(delta);
  }

  /**
   * Moves all scene objects toward the player at worldSpeed, recycling them
   * when they pass behind the camera to create an infinite scrolling effect.
   */
  private moveWorldObjects(delta: number): void {
    const scrollAmount = this._worldSpeed * delta;

    // ── Scroll ground texture (sleepers + rails flow toward player) ──
    this.groundTexture.offset.y -= scrollAmount * 0.025;

    // Platform sections, obstacles, coins & tunnels are scrolled by the Spawner
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private updateDebugOverlay(): void {
    this.fpsFrames++;
    const now = performance.now();

    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round(this.fpsFrames / ((now - this.lastFpsTime) / 1000));
      this.fpsFrames = 0;
      this.lastFpsTime = now;
    }

    const speedKmh = Math.round(this._worldSpeed * 3.6); // Convert to "km/h" for fun
    // Lane index → VISUAL screen side (camera looks toward +Z, so world +X is screen-LEFT):
    // lane 0 = X=-3 = screen RIGHT, lane 2 = X=+3 = screen LEFT
    const laneLabel = ['R', 'C', 'L'][this.player.lane];

    this.debugEl.textContent =
      `FPS: ${this.currentFps} | ${this.player.state.toUpperCase()}\n` +
      `X: ${this.player.position.x.toFixed(2)} | Y: ${this.player.position.y.toFixed(2)}m\n` +
      `Target X: ${this.player.targetX.toFixed(2)}\n` +
      `Speed: ${speedKmh} km/h\n` +
      `Obstacles: ${this.spawner.activeObstacleCount} | Coins: ${this.spawner.activeCoinCount}`;

    // Update lane indicator at bottom of screen
    this.laneIndicatorEl.textContent = `LANE: ${laneLabel}  |  X=${this.player.position.x.toFixed(2)}  |  ←=LEFT  →=RIGHT`;
    const colors = ['#ff4444', '#44ff44', '#4488ff'];
    this.laneIndicatorEl.style.color = colors[this.player.lane];
  }

  // ── Resize Handler ──────────────────────────────────────────
  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // ── Public API ──────────────────────────────────────────────
  public get state(): GameState { return this.gameState; }
  public set state(value: GameState) { this.gameState = value; }

  public get sceneRef(): THREE.Scene { return this.scene; }
  public get cameraRef(): THREE.PerspectiveCamera { return this.camera; }
  public get rendererRef(): THREE.WebGLRenderer { return this.renderer; }
  public get clockRef(): THREE.Clock { return this.clock; }

  // World movement accessors (for subsystems)
  public get worldSpeed(): number { return this._worldSpeed; }
  public set worldSpeed(value: number) { this._worldSpeed = Math.max(0, value); }
  public get distanceTraveled(): number { return this._distanceTraveled; }

  // Player reference (for input systems and subsystems)
  public get playerRef(): Player { return this.player; }

  // Spawner reference (for collision/scoring in Phase 5+)
  public get spawnerRef(): Spawner { return this.spawner; }

  // Ground reference (for scrolling texture access)
  public get groundRef(): THREE.Mesh { return this.ground; }
}
