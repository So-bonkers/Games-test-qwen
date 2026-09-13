import * as THREE from 'three';

export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.three = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.three.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.three.domElement);
    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.three.setSize(window.innerWidth, window.innerHeight);
  };

  render(scene: THREE.Scene): void {
    this.three.render(scene, this.camera);
  }

  get drawCalls(): number {
    return this.three.info.render.calls;
  }

  get triangles(): number {
    return this.three.info.render.triangles;
  }
}
