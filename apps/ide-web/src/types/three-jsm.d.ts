declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher, MOUSE, TOUCH, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    object: Camera;
    domElement: HTMLElement;
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };
    touches: { ONE: TOUCH; TWO: TOUCH };
    update(): boolean;
    dispose(): void;
  }
}

declare module "three/examples/jsm/loaders/OBJLoader" {
  import { Group, LoadingManager } from "three";

  export class OBJLoader {
    constructor(manager?: LoadingManager);
    parse(text: string): Group;
  }
}

declare module "three/examples/jsm/controls/PointerLockControls" {
  import { Camera, EventDispatcher } from "three";

  export class PointerLockControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    domElement: HTMLElement;
    isLocked: boolean;
    lock(unadjustedMovement?: boolean): void;
    unlock(): void;
    moveForward(distance: number): void;
    moveRight(distance: number): void;
  }
}

declare module "three/examples/jsm/controls/PointerLockControls.js" {
  import { Camera, EventDispatcher } from "three";

  export class PointerLockControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    domElement: HTMLElement;
    isLocked: boolean;
    lock(unadjustedMovement?: boolean): void;
    unlock(): void;
    moveForward(distance: number): void;
    moveRight(distance: number): void;
  }
}
