import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import './style.css';

const viewportElement = document.querySelector<HTMLDivElement>('#viewport');
const toolbarElement = document.querySelector<HTMLDivElement>('.toolbar');
const sidebarElement = document.querySelector<HTMLElement>('.sidebar');
const sidebarResizeElement = document.querySelector<HTMLDivElement>('.sidebar-resize');
const panelResizeElement = document.querySelector<HTMLDivElement>('.panel-resize');
const hierarchyPanelElement = document.querySelector<HTMLElement>('.hierarchy-panel');
const propertiesPanelElement = document.querySelector<HTMLElement>('.properties-panel');
const addButtonElement = document.querySelector<HTMLButtonElement>('.add-button');
const shapeMenuElement = document.querySelector<HTMLDivElement>('#shape-menu');
const sceneContentsElement = document.querySelector<HTMLDivElement>('#scene-contents');
const sceneDisclosureElement = document.querySelector<HTMLButtonElement>('.scene-root');
const propertiesElement = document.querySelector<HTMLDivElement>('.properties-empty');
const distanceInputElement = document.querySelector<HTMLInputElement>('#render-distance');
const distanceOutputElement = document.querySelector<HTMLOutputElement>('#render-distance-value');
const customCursorElement = document.querySelector<HTMLDivElement>('#custom-cursor');
const snapButtonElement = document.querySelector<HTMLButtonElement>('.snap-button');
const editButtonElement = document.querySelector<HTMLButtonElement>('.edit-button');
const editMenuElement = document.querySelector<HTMLDivElement>('#edit-menu');
const eyedropperButtonElement = document.querySelector<HTMLButtonElement>('.eyedropper-button');
const pointGeoButtonElement = document.querySelector<HTMLButtonElement>('.point-geo-button');
const geoMoveButtonElement = document.querySelector<HTMLButtonElement>('.geo-move-button');
const addGeometryPointButtonElement = document.querySelector<HTMLButtonElement>('.add-geometry-point-button');
const debugButtonElement = document.querySelector<HTMLButtonElement>('.debug-button');
const debugPanelElement = document.querySelector<HTMLElement>('#debug-panel');
const debugEmptyElement = document.querySelector<HTMLDivElement>('.debug-empty');
const debugEntriesElement = document.querySelector<HTMLOListElement>('.debug-entries');
const debugClearElement = document.querySelector<HTMLButtonElement>('.debug-clear');
const objectContextMenuElement = document.querySelector<HTMLDivElement>('#object-context-menu');

if (!viewportElement || !toolbarElement || !sidebarElement || !sidebarResizeElement ||
  !panelResizeElement || !hierarchyPanelElement || !propertiesPanelElement ||
  !addButtonElement || !shapeMenuElement ||
  !sceneContentsElement || !sceneDisclosureElement || !propertiesElement ||
  !distanceInputElement || !distanceOutputElement || !customCursorElement || !snapButtonElement ||
  !editButtonElement || !editMenuElement || !eyedropperButtonElement || !pointGeoButtonElement ||
  !geoMoveButtonElement || !addGeometryPointButtonElement ||
  !debugButtonElement || !debugPanelElement || !debugEmptyElement || !debugEntriesElement ||
  !debugClearElement || !objectContextMenuElement) {
  throw new Error('One or more editor interface elements could not be found.');
}

const viewport = viewportElement;
const toolbar = toolbarElement;
const sidebar = sidebarElement;
const sidebarResize = sidebarResizeElement;
const panelResize = panelResizeElement;
const hierarchyPanel = hierarchyPanelElement;
const propertiesPanel = propertiesPanelElement;
const addButton = addButtonElement;
const shapeMenu = shapeMenuElement;
const sceneContents = sceneContentsElement;
const sceneDisclosure = sceneDisclosureElement;
const properties = propertiesElement;
const distanceInput = distanceInputElement;
const distanceOutput = distanceOutputElement;
const customCursor = customCursorElement;
const snapButton = snapButtonElement;
const editButton = editButtonElement;
const editMenu = editMenuElement;
const eyedropperButton = eyedropperButtonElement;
const pointGeoButton = pointGeoButtonElement;
const geoMoveButton = geoMoveButtonElement;
const addGeometryPointButton = addGeometryPointButtonElement;
const debugButton = debugButtonElement;
const debugPanel = debugPanelElement;
const debugEmpty = debugEmptyElement;
const debugEntries = debugEntriesElement;
const debugClear = debugClearElement;
const objectContextMenu = objectContextMenuElement;
const contextLockButton = objectContextMenu.querySelector<HTMLButtonElement>('[data-action="lock"]')!;
const contextDeleteButton = objectContextMenu.querySelector<HTMLButtonElement>('[data-action="delete"]')!;

function addDebugEntry(message: string, source = '') {
  const entry = document.createElement('li');
  entry.className = 'debug-entry';
  entry.textContent = message;
  if (source) {
    const sourceLabel = document.createElement('span');
    sourceLabel.className = 'debug-entry-source';
    sourceLabel.textContent = source;
    entry.appendChild(sourceLabel);
  }
  debugEntries.appendChild(entry);
  while (debugEntries.childElementCount > 100) debugEntries.firstElementChild?.remove();
  debugEmpty.hidden = debugEntries.childElementCount > 0;
}

window.addEventListener('error', (event) => {
  const source = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '';
  addDebugEntry(event.message || 'Uncaught application error', source);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  addDebugEntry(
    reason instanceof Error ? reason.message : String(reason),
    reason instanceof Error ? reason.stack ?? '' : '',
  );
});
debugButton.addEventListener('click', () => {
  const expanded = debugButton.getAttribute('aria-expanded') === 'true';
  debugButton.setAttribute('aria-expanded', String(!expanded));
  debugPanel.hidden = expanded;
});
debugClear.addEventListener('click', () => {
  debugEntries.replaceChildren();
  debugEmpty.hidden = false;
});

const scene = new THREE.Scene();
scene.background = new THREE.Color('#171a1e');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(13, 12, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
};
let freeCameraEnabled = false;
let freeCameraLooking = false;
let freeCameraYaw = camera.rotation.y;
let freeCameraPitch = camera.rotation.x;
const freeCameraKeys = new Set<string>();

function syncNavigationControls() {
  controls.enabled = !freeCameraEnabled && !transformControls.dragging && !pointInteractionLocked;
}

function setFreeCameraEnabled(enabled: boolean) {
  if (freeCameraEnabled === enabled) return;
  freeCameraEnabled = enabled;
  freeCameraLooking = false;
  freeCameraKeys.clear();
  if (enabled) {
    const direction = camera.getWorldDirection(new THREE.Vector3());
    freeCameraYaw = Math.atan2(-direction.x, -direction.z);
    freeCameraPitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    camera.rotation.order = 'YXZ';
    camera.rotation.set(freeCameraPitch, freeCameraYaw, 0);
  } else {
    const direction = camera.getWorldDirection(new THREE.Vector3());
    controls.target.copy(camera.position).addScaledVector(direction, 10);
  }
  syncNavigationControls();
}

renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (freeCameraEnabled) {
    closeObjectContextMenu();
    return;
  }
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(objects, false)[0];
  if (hit?.object instanceof THREE.Mesh) showObjectContextMenu(hit.object, event.clientX, event.clientY);
  else closeObjectContextMenu();
});
let isOrbitDragging = false;
let isButtonPressed = false;
let lastCursorEvent: PointerEvent | null = null;
let pointInteractionLocked = false;
window.addEventListener('pointermove', (event) => {
  lastCursorEvent = event;
  const target = event.target instanceof Element ? event.target : null;
  isButtonPressed = Boolean(event.buttons & 1) && Boolean(target?.closest('button'));
  updateCursorAppearance(event);
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button === 2) {
    isOrbitDragging = true;
    if (freeCameraEnabled) {
      freeCameraLooking = true;
      renderer.domElement.setPointerCapture(event.pointerId);
    }
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!freeCameraEnabled || !freeCameraLooking) return;
  freeCameraYaw -= event.movementX * 0.0025;
  freeCameraPitch = THREE.MathUtils.clamp(
    freeCameraPitch - event.movementY * 0.0025,
    -Math.PI / 2 + 0.01,
    Math.PI / 2 - 0.01,
  );
  camera.rotation.set(freeCameraPitch, freeCameraYaw, 0);
});
window.addEventListener('pointerdown', (event) => {
  lastCursorEvent = event;
  const target = event.target instanceof Element ? event.target : null;
  isButtonPressed = event.button === 0 && Boolean(target?.closest('button'));
  updateCursorAppearance(event);
});
window.addEventListener('pointerup', (event) => {
  lastCursorEvent = event;
  isButtonPressed = false;
  if (event.button === 2) {
    isOrbitDragging = false;
    freeCameraLooking = false;
  }
  pointInteractionLocked = false;
  syncNavigationControls();
  updateCursorAppearance(event);
});
window.addEventListener('pointercancel', () => {
  isOrbitDragging = false;
  isButtonPressed = false;
  freeCameraLooking = false;
  freeCameraKeys.clear();
  finishGeometryPointDrag();
  if (lastCursorEvent) updateCursorAppearance(lastCursorEvent);
});
window.addEventListener('blur', () => {
  isOrbitDragging = false;
  isButtonPressed = false;
  freeCameraLooking = false;
  freeCameraKeys.clear();
  finishGeometryPointDrag();
  if (lastCursorEvent) updateCursorAppearance(lastCursorEvent);
});

type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());
const pointSelectionGizmo = new THREE.Group();
scene.add(pointSelectionGizmo);
let transformMode: TransformMode = 'select';
let isTransformDragging = false;
let snappingEnabled = false;
let eyedropperEnabled = false;
let pointGeoEnabled = false;
let geoMoveEnabled = false;
let manualPointSelectionEnabled = false;
let pointEditObject: THREE.Mesh | null = null;
let selectedPointObject: THREE.Mesh | null = null;
let selectedGeometryPoints: THREE.Mesh[] = [];
let pointSelectionStartWorld = new Map<THREE.Mesh, THREE.Vector3>();
const pointSelectionStartCenter = new THREE.Vector3();
let addingGeometryPoint = false;
let pointStatusElement: HTMLDivElement | null = null;
let eyedropperColor: THREE.Color | null = null;
const recentColors: string[] = [];
const lockedObjects = new WeakSet<THREE.Mesh>();
const pointGeometryNames = new WeakMap<THREE.Mesh, string>();
const pointGeometryPoints = new WeakMap<THREE.Mesh, THREE.Vector3[]>();
const topologyUpdateTimers = new WeakMap<THREE.Mesh, number>();
let geometryPointMarkers: THREE.Mesh[] = [];
let pointPreviewFrame: number | null = null;
let pointEditTriangleCount = 0;
const pointMarkerWorldPosition = new THREE.Vector3();
const originalEmissive = new WeakMap<THREE.Mesh, { color: THREE.Color; intensity: number }>();
let contextTargetObject: THREE.Mesh | null = null;

function isObjectLocked(mesh: THREE.Mesh): boolean {
  return lockedObjects.has(mesh);
}

function recordRecentColor(color: THREE.Color) {
  const hex = `#${color.getHexString()}`;
  const existing = recentColors.indexOf(hex);
  if (existing >= 0) recentColors.splice(existing, 1);
  recentColors.unshift(hex);
  recentColors.length = Math.min(recentColors.length, 8);
}
let selectedObject: THREE.Mesh | null = null;
let transformReadouts: { position: HTMLDivElement; rotation: HTMLDivElement; scale: HTMLDivElement } | null = null;
const selectionHighlight = new THREE.BoxHelper(new THREE.Object3D(), '#f0bc62');
selectionHighlight.visible = false;
const selectionHighlightMaterial = selectionHighlight.material as THREE.LineBasicMaterial;
selectionHighlightMaterial.depthTest = false;
selectionHighlightMaterial.toneMapped = false;
scene.add(selectionHighlight);
const hoverHighlight = new THREE.BoxHelper(new THREE.Object3D(), '#ffff00');
hoverHighlight.visible = false;
const hoverHighlightMaterial = hoverHighlight.material as THREE.LineBasicMaterial;
hoverHighlightMaterial.depthTest = false;
hoverHighlightMaterial.toneMapped = false;
hoverHighlightMaterial.transparent = true;
hoverHighlightMaterial.opacity = 0.95;
scene.add(hoverHighlight);

function getObjectHighlightColor(mesh: THREE.Mesh): THREE.Color {
  const material = mesh.material;
  if (!(material instanceof THREE.MeshStandardMaterial)) return new THREE.Color('#ffff00');
  return new THREE.Color().setHex(0xffffff ^ material.color.getHex());
}

function setMeshSelectionHighlight(mesh: THREE.Mesh, highlighted: boolean) {
  if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
  const material = mesh.material;
  if (!originalEmissive.has(mesh)) {
    originalEmissive.set(mesh, { color: material.emissive.clone(), intensity: material.emissiveIntensity });
  }
  const original = originalEmissive.get(mesh)!;
  if (highlighted) {
    material.emissive.set('#a86a00');
    material.emissiveIntensity = 1.6;
  } else {
    material.emissive.copy(original.color);
    material.emissiveIntensity = original.intensity;
  }
}

function setEyedropperEnabled(enabled: boolean) {
  eyedropperEnabled = enabled;
  eyedropperColor = null;
  eyedropperButton.setAttribute('aria-pressed', String(enabled));
  eyedropperButton.textContent = enabled ? 'Pick source color…' : 'Eyedropper';
  if (lastCursorEvent) updateCursorAppearance(lastCursorEvent);
  hoverHighlight.visible = false;
  if (selectedObject) {
    (selectionHighlight.material as THREE.LineBasicMaterial).color.copy(
      enabled ? getObjectHighlightColor(selectedObject) : new THREE.Color('#f0bc62'),
    );
  }
}

function updateEyedropperHover(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
  if (!eyedropperEnabled) {
    hoverHighlight.visible = false;
    return;
  }
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(objects, false)[0];
  if (!hit || !(hit.object instanceof THREE.Mesh) || isObjectLocked(hit.object)) {
    hoverHighlight.visible = false;
    return;
  }
  hoverHighlight.setFromObject(hit.object);
  hoverHighlightMaterial.color.copy(getObjectHighlightColor(hit.object));
  hoverHighlight.visible = true;
}

transformControls.addEventListener('dragging-changed', () => {
  isTransformDragging = transformControls.dragging;
  syncNavigationControls();
  if (!transformControls.dragging && pointEditObject &&
    transformControls.object === pointSelectionGizmo && selectedGeometryPoints.length > 0) {
    if (pointPreviewFrame !== null) {
      cancelAnimationFrame(pointPreviewFrame);
      pointPreviewFrame = null;
    }
    rebuildPointGeometry(pointEditObject);
    captureGeometryPointSelectionStart();
  }
});
transformControls.addEventListener('objectChange', () => {
  if (pointEditObject && transformControls.object === pointSelectionGizmo &&
    selectedGeometryPoints.length > 0) {
    const movement = pointSelectionGizmo.position.clone().sub(pointSelectionStartCenter);
    const points = pointGeometryPoints.get(pointEditObject);
    if (points) {
      for (const marker of selectedGeometryPoints) {
        const start = pointSelectionStartWorld.get(marker);
        const markerIndex = geometryPointMarkers.indexOf(marker);
        if (!start || markerIndex < 0) continue;
        const parent = marker.parent;
        if (!(parent instanceof THREE.Mesh)) continue;
        parent.updateWorldMatrix(true, false);
        marker.position.copy(parent.worldToLocal(start.clone().add(movement)));
        points[markerIndex].copy(marker.position);
      }
      updatePointGeometryPreview();
    }
  }
  if (selectedObject && transformReadouts) {
    const { position, rotation, scale } = selectedObject;
    transformReadouts.position.textContent = `Position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`;
    transformReadouts.rotation.textContent = `Rotation: ${THREE.MathUtils.radToDeg(rotation.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(rotation.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(rotation.z).toFixed(1)}°`;
    transformReadouts.scale.textContent = `Scale: ${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)}`;
  }
});

scene.add(new THREE.HemisphereLight('#cbd7e6', '#32363c', 2.2));

const keyLight = new THREE.DirectionalLight('#fff1dc', 3.5);
keyLight.position.set(8, 14, 10);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight('#91b6d8', 1.2);
fillLight.position.set(-10, 7, -8);
scene.add(fillLight);

const gridDistance = Number(distanceInput.value);
const gridMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uCameraPosition: { value: new THREE.Vector3() },
    uRenderDistance: { value: gridDistance },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPosition;
    uniform vec3 uCameraPosition;
    uniform float uRenderDistance;

    float gridLine(vec2 coordinate, float spacing) {
      vec2 grid = abs(fract(coordinate / spacing - 0.5) - 0.5) / fwidth(coordinate / spacing);
      return 1.0 - min(min(grid.x, grid.y), 1.0);
    }

    void main() {
      vec2 position = vWorldPosition.xz;
      float minorLine = gridLine(position, 1.0);
      float majorLine = gridLine(position, 10.0);
      float distanceFromCamera = length(position - uCameraPosition.xz);
      float fade = 1.0 - smoothstep(uRenderDistance * 0.7, uRenderDistance, distanceFromCamera);
      vec3 color = mix(vec3(0.20, 0.22, 0.24), vec3(0.39, 0.42, 0.44), majorLine * 0.8);
      float opacity = max(minorLine * 0.42, majorLine * 0.7) * fade;
      gl_FragColor = vec4(color, opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
let gridGeometry = new THREE.PlaneGeometry(gridDistance * 2, gridDistance * 2);
const grid = new THREE.Mesh(gridGeometry, gridMaterial);
grid.rotation.x = -Math.PI / 2;
grid.position.y = -0.02;
grid.frustumCulled = false;
scene.add(grid);

distanceInput.addEventListener('input', () => {
  const distance = Number(distanceInput.value);
  distanceOutput.value = String(distance);
  gridMaterial.uniforms.uRenderDistance.value = distance;
  gridGeometry.dispose();
  gridGeometry = new THREE.PlaneGeometry(distance * 2, distance * 2);
  grid.geometry = gridGeometry;
});

interface ShapeDefinition {
  createBaseGeometry: () => THREE.BufferGeometry;
  groundOffset: number;
  minimumTriangles: number;
  projectToSurface: (point: THREE.Vector3) => THREE.Vector3;
}

const shapeDefinitions: Record<string, ShapeDefinition> = {
  Cube: {
    createBaseGeometry: () => new THREE.BoxGeometry(1, 1, 1),
    groundOffset: 0.5,
    minimumTriangles: 30,
    projectToSurface: (point) => point,
  },
  Sphere: {
    createBaseGeometry: () => new THREE.SphereGeometry(0.5, 8, 6),
    groundOffset: 0.5,
    minimumTriangles: 150,
    projectToSurface: (point) => point.normalize().multiplyScalar(0.5),
  },
  Cylinder: {
    createBaseGeometry: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1),
    groundOffset: 0.5,
    minimumTriangles: 150,
    projectToSurface: (point) => {
      if (Math.abs(point.y) > 0.49) {
        point.y = Math.sign(point.y) * 0.5;
        const radius = Math.hypot(point.x, point.z);
        if (radius > 0) {
          point.x *= 0.5 / radius;
          point.z *= 0.5 / radius;
        }
      } else {
        point.y = THREE.MathUtils.clamp(point.y, -0.5, 0.5);
        const radius = Math.hypot(point.x, point.z);
        if (radius > 0) {
          point.x *= 0.5 / radius;
          point.z *= 0.5 / radius;
        }
      }
      return point;
    },
  },
  Cone: {
    createBaseGeometry: () => new THREE.ConeGeometry(0.5, 1, 8, 1),
    groundOffset: 0.5,
    minimumTriangles: 30,
    projectToSurface: (point) => {
      point.y = THREE.MathUtils.clamp(point.y, -0.5, 0.5);
      const radius = 0.5 * (0.5 - point.y);
      const currentRadius = Math.hypot(point.x, point.z);
      if (currentRadius > 0) {
        point.x *= radius / currentRadius;
        point.z *= radius / currentRadius;
      }
      return point;
    },
  },
  Torus: {
    createBaseGeometry: () => new THREE.TorusGeometry(0.38, 0.12, 4, 8),
    groundOffset: 0.12,
    minimumTriangles: 150,
    projectToSurface: (point) => {
      const radial = Math.hypot(point.x, point.y) || 1;
      const centerX = point.x * (0.38 / radial);
      const centerY = point.y * (0.38 / radial);
      const offsetX = point.x - centerX;
      const offsetY = point.y - centerY;
      const offsetZ = point.z;
      const offsetLength = Math.hypot(offsetX, offsetY, offsetZ) || 1;
      return new THREE.Vector3(
        centerX + offsetX * (0.12 / offsetLength),
        centerY + offsetY * (0.12 / offsetLength),
        offsetZ * (0.12 / offsetLength),
      );
    },
  },
  Pill: {
    createBaseGeometry: () => new THREE.CapsuleGeometry(0.5, 1, 2, 6),
    groundOffset: 1,
    minimumTriangles: 140,
    projectToSurface: (point) => {
      const centerY = THREE.MathUtils.clamp(point.y, -0.5, 0.5);
      const offsetY = point.y - centerY;
      const length = Math.hypot(point.x, offsetY, point.z) || 1;
      return new THREE.Vector3(point.x * (0.5 / length), centerY + offsetY * (0.5 / length), point.z * (0.5 / length));
    },
  },
};

interface Triangle {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
}

interface TriangleCandidate {
  triangle: Triangle;
  edge: [keyof Triangle, keyof Triangle];
  length: number;
  index: number;
}

function createTriangleGeometry(
  shape: string,
  targetCount: number,
  customBaseGeometry?: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const definition = shapeDefinitions[shape];
  const customSource = customBaseGeometry ?? definition.createBaseGeometry();
  const sourceGeometry = customSource.index ? customSource.toNonIndexed() : customSource.clone();
  const sourcePositions = sourceGeometry.getAttribute('position');
  const sourcePoints: THREE.Vector3[] = [];
  const triangles: Triangle[] = [];
  for (let index = 0; index < sourcePositions.count; index += 3) {
    const a = new THREE.Vector3(sourcePositions.getX(index), sourcePositions.getY(index), sourcePositions.getZ(index));
    const b = new THREE.Vector3(sourcePositions.getX(index + 1), sourcePositions.getY(index + 1), sourcePositions.getZ(index + 1));
    const c = new THREE.Vector3(sourcePositions.getX(index + 2), sourcePositions.getY(index + 2), sourcePositions.getZ(index + 2));
    triangles.push({ a, b, c });
    sourcePoints.push(a, b, c);
  }
  const sourceBounds = new THREE.Box3().setFromPoints(sourcePoints);
  sourceGeometry.dispose();

  const heap: TriangleCandidate[] = [];
  const pushCandidate = (triangle: Triangle, triangleIndex: number) => {
    const edges: Array<[keyof Triangle, keyof Triangle]> = [['a', 'b'], ['b', 'c'], ['c', 'a']];
    let edge = edges[0];
    let length = triangle[edge[0]].distanceToSquared(triangle[edge[1]]);
    for (const candidateEdge of edges.slice(1)) {
      const candidateLength = triangle[candidateEdge[0]].distanceToSquared(triangle[candidateEdge[1]]);
      if (candidateLength > length) {
        edge = candidateEdge;
        length = candidateLength;
      }
    }
    const candidate = { triangle, edge, length, index: triangleIndex };
    heap.push(candidate);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].length >= candidate.length) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = candidate;
  };
  const popCandidate = (): TriangleCandidate => {
    const first = heap[0];
    const last = heap.pop();
    if (!last) throw new Error('Triangle refinement queue became empty.');
    if (heap.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        const child = right < heap.length && heap[right].length > heap[left].length ? right : left;
        if (heap[child].length <= last.length) break;
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = last;
    }
    return first;
  };
  triangles.forEach((triangle, index) => pushCandidate(triangle, index));

  while (triangles.length < targetCount) {
    const { index: splitIndex, edge: splitEdge } = popCandidate();
    const triangle = triangles[splitIndex];
    const [startKey, endKey] = splitEdge;
    const thirdKey = (['a', 'b', 'c'] as const).find((key) => key !== startKey && key !== endKey)!;
    const midpoint = triangle[startKey].clone().add(triangle[endKey]).multiplyScalar(0.5);
    const projectedMidpoint = customBaseGeometry ? midpoint : definition.projectToSurface(midpoint);
    const first: Triangle = { a: triangle.a.clone(), b: triangle.b.clone(), c: triangle.c.clone() };
    const second: Triangle = { a: triangle.a.clone(), b: triangle.b.clone(), c: triangle.c.clone() };
    first[startKey] = projectedMidpoint.clone();
    second[endKey] = projectedMidpoint.clone();
    first[thirdKey] = triangle[thirdKey].clone();
    second[thirdKey] = triangle[thirdKey].clone();
    triangles[splitIndex] = first;
    triangles.push(second);
    pushCandidate(first, splitIndex);
    pushCandidate(second, triangles.length - 1);
  }

  const vertices = new Float32Array(triangles.length * 9);
  const point = new THREE.Vector3();
  triangles.forEach((triangle, index) => {
    [triangle.a, triangle.b, triangle.c].forEach((vertex, vertexIndex) => {
      point.copy(vertex);
      const offset = (index * 3 + vertexIndex) * 3;
      vertices[offset] = point.x;
      vertices[offset + 1] = point.y;
      vertices[offset + 2] = point.z;
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const resultBounds = geometry.boundingBox!;
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const resultSize = resultBounds.getSize(new THREE.Vector3());
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  const resultCenter = resultBounds.getCenter(new THREE.Vector3());
  const scale = new THREE.Vector3(
    sourceSize.x / (resultSize.x || 1),
    sourceSize.y / (resultSize.y || 1),
    sourceSize.z / (resultSize.z || 1),
  );
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    point.fromBufferAttribute(positions, index).sub(resultCenter).multiply(scale).add(sourceCenter);
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const objects: THREE.Mesh[] = [];
const objectShapes = new WeakMap<THREE.Mesh, string>();
type MaterialPreset = 'Rubber' | 'Concrete' | 'Glass';
const objectMaterialPresets = new WeakMap<THREE.Mesh, MaterialPreset>();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let placementShape: string | null = null;
let previewMesh: THREE.Mesh | null = null;
let placementPosition = new THREE.Vector3(0, 0, 0);
let lastPointerPosition = new THREE.Vector2();
let placementJustCommitted = false;

function updateCursorAppearance(event: Pick<PointerEvent, 'clientX' | 'clientY' | 'target'>) {
  customCursor.style.left = `${event.clientX}px`;
  customCursor.style.top = `${event.clientY}px`;
  const target = event.target instanceof Element ? event.target : null;
  const insideViewport = Boolean(target && viewport.contains(target));
  const overButton = Boolean(target?.closest('button'));
  const pointEditLockedControl = pointEditObject !== null && Boolean(target?.closest('.point-edit-locked'));
  let hoveringLockedObject = false;

  if (insideViewport) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(objects, false)[0];
    hoveringLockedObject = hit?.object instanceof THREE.Mesh && isObjectLocked(hit.object);
  }

  const blocked = hoveringLockedObject || (placementShape !== null && !insideViewport) || pointEditLockedControl;
  const useHand = !blocked && (!insideViewport || overButton);
  const useEyedropper = !blocked && insideViewport && eyedropperEnabled;
  const usePropeller = !blocked && insideViewport && !useEyedropper && !overButton;
  customCursor.classList.toggle('hand-mode', useHand);
  customCursor.classList.toggle('blocked-mode', blocked);
  customCursor.classList.toggle('eyedropper-mode', useEyedropper);
  customCursor.classList.toggle('propeller-mode', usePropeller);
  customCursor.classList.toggle('button-pressed', useHand && isButtonPressed);
  customCursor.classList.toggle('spinning', usePropeller && isOrbitDragging);
}

function updateProperties(mesh: THREE.Mesh) {
  pointStatusElement = null;
  if (selectedPointObject === mesh) {
    updatePointGeometryProperties(mesh);
    return;
  }
  properties.classList.remove('properties-empty');
  properties.classList.add('properties-content');
  properties.replaceChildren();

  const form = document.createElement('div');
  form.className = 'properties-form';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'property-field';
  nameLabel.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = mesh.name;
  nameInput.setAttribute('aria-label', 'Object name');
  nameInput.addEventListener('input', () => {
    mesh.name = nameInput.value;
    sceneContents.querySelectorAll<HTMLElement>('.scene-object-row').forEach((row) => {
      if (row.dataset.uuid === mesh.uuid) {
        const selectButton = row.querySelector<HTMLButtonElement>('.scene-object');
        if (selectButton) selectButton.textContent = mesh.name || 'Object';
      }
    });
    updateObjectLockControls(mesh);
  });
  nameLabel.appendChild(nameInput);

  const shape = objectShapes.get(mesh);
  if (!shape) throw new Error(`The shape type for "${mesh.name}" was not found.`);
  const definition = shapeDefinitions[shape];
  const modelSection = document.createElement('section');
  modelSection.className = 'property-section';
  const modelToggle = document.createElement('button');
  modelToggle.className = 'property-section-toggle';
  modelToggle.type = 'button';
  modelToggle.setAttribute('aria-expanded', 'false');
  modelToggle.innerHTML = '<span class="section-chevron">›</span><span>Model</span>';
  const modelDetails = document.createElement('div');
  modelDetails.className = 'model-details';
  modelDetails.hidden = true;
  const topologyStatus = document.createElement('div');
  topologyStatus.className = 'topology-update-status';
  modelToggle.addEventListener('click', () => {
    const expanded = modelToggle.getAttribute('aria-expanded') === 'true';
    modelToggle.setAttribute('aria-expanded', String(!expanded));
    modelToggle.querySelector('.section-chevron')!.textContent = expanded ? '›' : '⌄';
    modelDetails.hidden = expanded;
  });
  const faceCount = mesh.geometry.getAttribute('position').count / 3;
  const isTorus = shape === 'Torus';
  const topology = {
    edges: Math.round(faceCount * 1.5),
    vertices: Math.round(faceCount / 2 + (isTorus ? 0 : 2)),
    faces: faceCount,
  };
  const topologyInputs = new Map<keyof typeof topology, HTMLInputElement>();
  const topologyLimits = {
    edges: { min: Math.ceil(definition.minimumTriangles * 1.5), max: 15000 },
    vertices: { min: Math.ceil(definition.minimumTriangles / 2 + (isTorus ? 0 : 2)), max: isTorus ? 5000 : 5002 },
    faces: { min: definition.minimumTriangles, max: 10000 },
  };
  const setFaceCount = (requested: number) => {
    const nextFaceCount = THREE.MathUtils.clamp(
      Math.floor(requested),
      definition.minimumTriangles,
      10000,
    );
    const pendingTimer = topologyUpdateTimers.get(mesh);
    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      topologyUpdateTimers.delete(mesh);
    }
    const currentFaceCount = mesh.geometry.getAttribute('position').count / 3;
    if (nextFaceCount !== currentFaceCount) {
      topologyStatus.textContent = 'Applying topology in 1.5 seconds…';
      if (!topologyStatus.isConnected) modelDetails.appendChild(topologyStatus);
      const timer = window.setTimeout(() => {
        const pointData = pointGeometryPoints.get(mesh);
        let sourceGeometry: THREE.BufferGeometry | undefined;
        if (pointData) sourceGeometry = new ConvexGeometry(pointData);
        const previousGeometry = mesh.geometry;
        mesh.geometry = createTriangleGeometry(shape, nextFaceCount, sourceGeometry);
        sourceGeometry?.dispose();
        previousGeometry.dispose();
        const updatedFaceCount = mesh.geometry.getAttribute('position').count / 3;
        topology.edges = Math.round(updatedFaceCount * 1.5);
        topology.vertices = Math.round(updatedFaceCount / 2 + (isTorus ? 0 : 2));
        topology.faces = updatedFaceCount;
        for (const [key, input] of topologyInputs) input.value = String(topology[key]);
        topologyStatus.textContent = 'Topology updated.';
        selectionHighlight.update();
        topologyUpdateTimers.delete(mesh);
      }, 1500);
      topologyUpdateTimers.set(mesh, timer);
    } else {
      topologyStatus.textContent = '';
    }
    topology.faces = nextFaceCount;
    topology.edges = Math.round(nextFaceCount * 1.5);
    topology.vertices = Math.round(nextFaceCount / 2 + (isTorus ? 0 : 2));
    for (const [key, input] of topologyInputs) {
      input.value = String(topology[key]);
    }
    selectionHighlight.update();
  };
  (Object.keys(topology) as Array<keyof typeof topology>).forEach((key) => {
    const label = document.createElement('label');
    label.className = 'property-field topology-field';
    label.textContent = key[0].toUpperCase() + key.slice(1);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(topologyLimits[key].min);
    input.max = String(topologyLimits[key].max);
    input.step = '1';
    input.value = String(topology[key]);
    input.setAttribute('aria-label', key[0].toUpperCase() + key.slice(1));
    input.addEventListener('change', () => {
      const requested = Number(input.value);
      if (!Number.isFinite(requested)) {
        input.value = String(topology[key]);
        return;
      }
      const bounded = THREE.MathUtils.clamp(
        Math.floor(requested),
        topologyLimits[key].min,
        topologyLimits[key].max,
      );
      const requestedFaces = key === 'faces'
        ? bounded
        : key === 'edges'
          ? Math.round(bounded * 2 / 3)
          : Math.round((bounded - (isTorus ? 0 : 2)) * 2);
      setFaceCount(requestedFaces);
    });
    topologyInputs.set(key, input);
    label.appendChild(input);
    modelDetails.appendChild(label);
  });
  modelSection.append(modelToggle, modelDetails);

  const meshMaterial = mesh.material;
  if (!(meshMaterial instanceof THREE.MeshStandardMaterial)) {
    throw new Error(`The material for "${mesh.name}" cannot be edited in Properties.`);
  }
  const material = meshMaterial;
  const chromaticsSection = document.createElement('section');
  chromaticsSection.className = 'property-section';
  const chromaticsToggle = document.createElement('button');
  chromaticsToggle.className = 'property-section-toggle';
  chromaticsToggle.type = 'button';
  chromaticsToggle.setAttribute('aria-expanded', 'false');
  chromaticsToggle.innerHTML = '<span class="section-chevron">›</span><span>Chromatics</span>';
  const chromaticsDetails = document.createElement('div');
  chromaticsDetails.className = 'chromatics-details';
  chromaticsDetails.hidden = true;
  chromaticsToggle.addEventListener('click', () => {
    const expanded = chromaticsToggle.getAttribute('aria-expanded') === 'true';
    chromaticsToggle.setAttribute('aria-expanded', String(!expanded));
    chromaticsToggle.querySelector('.section-chevron')!.textContent = expanded ? '›' : '⌄';
    chromaticsDetails.hidden = expanded;
  });
  const wheel = document.createElement('canvas');
  wheel.className = 'color-wheel';
  wheel.width = 144;
  wheel.height = 144;
  wheel.setAttribute('role', 'slider');
  wheel.setAttribute('aria-label', 'Color wheel');
  wheel.setAttribute('tabindex', '0');
  drawColorWheel(wheel);
  const wheelSelector = document.createElement('span');
  wheelSelector.className = 'wheel-selector';
  const updateWheelSelector = () => {
    const hsl = { h: 0, s: 0, l: 0 };
    material.color.getHSL(hsl, THREE.SRGBColorSpace);
    const angle = hsl.h * Math.PI * 2;
    const distance = hsl.s * 50;
    wheelSelector.style.left = `${50 + Math.cos(angle) * distance}%`;
    wheelSelector.style.top = `${50 - Math.sin(angle) * distance}%`;
  };
  const updateColorFromWheel = (event: PointerEvent) => {
    const bounds = wheel.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
    const saturation = Math.min(1, Math.hypot(x, y));
    const hue = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1;
    material.color.setHSL(hue, saturation, 0.5, THREE.SRGBColorSpace);
    updateColorControls();
  };
  wheel.addEventListener('pointerdown', (event) => {
    wheel.setPointerCapture(event.pointerId);
    updateColorFromWheel(event);
  });
  wheel.addEventListener('pointermove', (event) => {
    if (event.buttons & 1) updateColorFromWheel(event);
  });
  wheel.addEventListener('pointerup', () => {
    recordRecentColor(material.color);
    renderRecentColors();
  });
  const palette = document.createElement('div');
  palette.className = 'color-palette';
  palette.setAttribute('aria-label', '36 preset colors');
  const paletteColors = Array.from({ length: 36 }, (_, index) => {
    const hue = index / 36;
    return `#${new THREE.Color().setHSL(hue, 0.72, 0.52, THREE.SRGBColorSpace).getHexString()}`;
  });
  const paletteButtons: HTMLButtonElement[] = [];
  paletteColors.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-label', `Set object color ${color}`);
    swatch.addEventListener('click', () => {
      material.color.set(color);
      updateColorControls();
      recordRecentColor(material.color);
      renderRecentColors();
    });
    paletteButtons.push(swatch);
    palette.appendChild(swatch);
  });
  function updatePaletteSelection() {
    const selectedColor = `#${material.color.getHexString()}`;
    paletteButtons.forEach((swatch, index) => {
      swatch.classList.toggle('selected', paletteColors[index] === selectedColor);
    });
  }
  const wheelRow = document.createElement('div');
  wheelRow.className = 'color-wheel-row';
  wheelRow.append(wheel, wheelSelector);

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'hex-field-input';
  hexInput.maxLength = 7;
  hexInput.value = `#${material.color.getHexString()}`;
  hexInput.setAttribute('aria-label', 'Hex color');
  hexInput.addEventListener('change', () => {
    if (!/^#[0-9a-f]{6}$/i.test(hexInput.value)) {
      hexInput.value = `#${material.color.getHexString()}`;
      return;
    }
    material.color.set(hexInput.value);
    updateColorControls();
    recordRecentColor(material.color);
    renderRecentColors();
  });

  const rgb = new THREE.Color();
  const channelInputs = new Map<string, HTMLInputElement>();
  const colorValues = document.createElement('div');
  colorValues.className = 'color-values';
  const addChannelHeading = (heading: string) => {
    const title = document.createElement('span');
    title.className = 'channel-group-heading';
    title.textContent = heading;
    colorValues.appendChild(title);
  };
  const makeChannelInput = (labelText: string, key: string, max: number, className = '') => {
    const label = document.createElement('label');
    label.className = `property-field ${className}`.trim();
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(max);
    input.step = '1';
    input.setAttribute('aria-label', labelText);
    input.addEventListener('change', () => {
      const value = THREE.MathUtils.clamp(Number(input.value) || 0, 0, max);
      if (key.startsWith('rgb')) {
        material.color.getRGB(rgb, THREE.SRGBColorSpace);
        if (key === 'rgbR') rgb.r = value / 255;
        if (key === 'rgbG') rgb.g = value / 255;
        if (key === 'rgbB') rgb.b = value / 255;
        material.color.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
      } else {
        material.color.getRGB(rgb, THREE.SRGBColorSpace);
        const currentHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        const hue = key === 'hsvH' ? value / 360 : currentHsv.h;
        const saturation = key === 'hsvS' ? value / 100 : currentHsv.s;
        const brightness = key === 'hsvV' ? value / 100 : currentHsv.v;
        const converted = hsvToRgb(hue, saturation, brightness);
        material.color.setRGB(converted.r, converted.g, converted.b, THREE.SRGBColorSpace);
      }
      updateColorControls();
      recordRecentColor(material.color);
      renderRecentColors();
    });
    channelInputs.set(key, input);
    label.appendChild(input);
    colorValues.appendChild(label);
  };
  addChannelHeading('RGB');
  makeChannelInput('R', 'rgbR', 255);
  makeChannelInput('G', 'rgbG', 255);
  makeChannelInput('B', 'rgbB', 255);
  addChannelHeading('HSV');
  makeChannelInput('H', 'hsvH', 360);
  makeChannelInput('S', 'hsvS', 100);
  makeChannelInput('V', 'hsvV', 100);
  const hexLabel = document.createElement('label');
  hexLabel.className = 'property-field hex-field';
  hexLabel.textContent = 'HEX';
  hexLabel.appendChild(hexInput);
  colorValues.appendChild(hexLabel);

  const recentRow = document.createElement('div');
  recentRow.className = 'recent-colors';
  const recentLabel = document.createElement('span');
  recentLabel.className = 'recent-colors-label';
  recentLabel.textContent = 'Recent';
  const renderRecentColors = () => {
    recentRow.replaceChildren(recentLabel);
    recentColors.forEach((recentColor) => {
      const recentButton = document.createElement('button');
      recentButton.type = 'button';
      recentButton.className = 'recent-color';
      recentButton.style.backgroundColor = recentColor;
      recentButton.title = recentColor;
      recentButton.setAttribute('aria-label', `Use recent color ${recentColor}`);
      recentButton.addEventListener('click', () => {
        material.color.set(recentColor);
        updateColorControls();
        recordRecentColor(material.color);
        renderRecentColors();
      });
      recentRow.appendChild(recentButton);
    });
  };
  function updateColorControls() {
    const hex = `#${material.color.getHexString()}`;
    hexInput.value = hex;
    material.color.getRGB(rgb, THREE.SRGBColorSpace);
    const currentHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    channelInputs.get('rgbR')!.value = String(Math.round(rgb.r * 255));
    channelInputs.get('rgbG')!.value = String(Math.round(rgb.g * 255));
    channelInputs.get('rgbB')!.value = String(Math.round(rgb.b * 255));
    channelInputs.get('hsvH')!.value = String(Math.round(currentHsv.h * 360) % 360);
    channelInputs.get('hsvS')!.value = String(Math.round(currentHsv.s * 100));
    channelInputs.get('hsvV')!.value = String(Math.round(currentHsv.v * 100));
    wheelSelector.style.backgroundColor = hex;
    updateWheelSelector();
    updatePaletteSelection();
    if (eyedropperEnabled && selectedObject === mesh) {
      selectionHighlightMaterial.color.copy(getObjectHighlightColor(mesh));
    }
  }
  const materialLabel = document.createElement('label');
  materialLabel.className = 'material-field';
  materialLabel.textContent = 'Material';
  const materialSelect = document.createElement('select');
  materialSelect.setAttribute('aria-label', 'Material type');
  const materialPresets = {
    Rubber: { roughness: 0.92, metalness: 0, transparent: false, opacity: 1 },
    Concrete: { roughness: 1, metalness: 0, transparent: false, opacity: 1 },
    Glass: { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35 },
  } as const;
  (Object.keys(materialPresets) as Array<keyof typeof materialPresets>).forEach((presetName) => {
    const option = document.createElement('option');
    option.value = presetName;
    option.textContent = presetName;
    materialSelect.appendChild(option);
  });
  materialSelect.value = objectMaterialPresets.get(mesh) ?? 'Rubber';
  materialSelect.addEventListener('change', () => {
    const preset = materialPresets[materialSelect.value as keyof typeof materialPresets];
    if (!preset) return;
    objectMaterialPresets.set(mesh, materialSelect.value as MaterialPreset);
    material.roughness = preset.roughness;
    material.metalness = preset.metalness;
    material.transparent = preset.transparent;
    material.opacity = preset.opacity;
    material.depthWrite = !preset.transparent;
    material.needsUpdate = true;
  });
  materialLabel.appendChild(materialSelect);

  chromaticsDetails.append(wheelRow, palette, colorValues, recentRow, materialLabel);
  updateColorControls();
  renderRecentColors();
  chromaticsSection.append(chromaticsToggle, chromaticsDetails);

  const position = document.createElement('div');
  const rotation = document.createElement('div');
  const scale = document.createElement('div');
  position.className = 'transform-readout';
  rotation.className = 'transform-readout';
  scale.className = 'transform-readout';
  transformReadouts = { position, rotation, scale };
  const { x, y, z } = mesh.position;
  position.textContent = `Position: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
  rotation.textContent = `Rotation: ${THREE.MathUtils.radToDeg(mesh.rotation.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(mesh.rotation.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(mesh.rotation.z).toFixed(1)}°`;
  scale.textContent = `Scale: ${mesh.scale.x.toFixed(2)}, ${mesh.scale.y.toFixed(2)}, ${mesh.scale.z.toFixed(2)}`;

  form.append(nameLabel, modelSection, chromaticsSection, position, rotation, scale);
  properties.appendChild(form);
}

function drawColorWheel(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the inline color wheel.');
  const image = context.createImageData(canvas.width, canvas.height);
  const center = (canvas.width - 1) / 2;
  const radius = center;
  const color = new THREE.Color();
  const channels = new THREE.Color();
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const dx = (x - center) / radius;
      const dy = (center - y) / radius;
      const saturation = Math.hypot(dx, dy);
      if (saturation > 1) continue;
      const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      color.setHSL(hue, saturation, 0.5, THREE.SRGBColorSpace);
      color.getRGB(channels, THREE.SRGBColorSpace);
      const index = (y * canvas.width + x) * 4;
      image.data[index] = Math.round(channels.r * 255);
      image.data[index + 1] = Math.round(channels.g * 255);
      image.data[index + 2] = Math.round(channels.b * 255);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const sector = (h * 6) % 6;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const m = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) [red, green] = [chroma, x];
  else if (sector < 2) [red, green] = [x, chroma];
  else if (sector < 3) [green, blue] = [chroma, x];
  else if (sector < 4) [green, blue] = [x, chroma];
  else if (sector < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];
  return { r: red + m, g: green + m, b: blue + m };
}

editButton.addEventListener('click', () => {
  const expanded = editButton.getAttribute('aria-expanded') === 'true';
  editButton.setAttribute('aria-expanded', String(!expanded));
  editMenu.hidden = expanded;
});

eyedropperButton.addEventListener('click', () => setEyedropperEnabled(!eyedropperEnabled));
pointGeoButton.addEventListener('click', () => setPointGeometryEnabled(!pointGeoEnabled));
geoMoveButton.addEventListener('click', () => setGeoMoveEnabled(!geoMoveEnabled));
addGeometryPointButton.addEventListener('click', () => {
  if (!pointEditObject) return;
  addingGeometryPoint = true;
  setGeometryPointSelection([]);
  transformControls.detach();
  if (pointStatusElement) pointStatusElement.textContent = 'Click on the object surface to add a point.';
  addGeometryPointButton.classList.add('active');
});

document.addEventListener('pointerdown', (event) => {
  if (!editMenu.contains(event.target as Node) && !editButton.contains(event.target as Node)) {
    editMenu.hidden = true;
    editButton.setAttribute('aria-expanded', 'false');
  }
});

function selectObject(mesh: THREE.Mesh | null) {
  if (pointEditObject && mesh !== pointEditObject && !finishPointEditing(true)) return;
  selectedPointObject = null;
  if (selectedObject && selectedObject !== mesh) setMeshSelectionHighlight(selectedObject, false);
  selectedObject = mesh;
  clearGeometryPointMarkers();
  if (mesh && pointGeometryPoints.has(mesh)) {
    pointGeometryPoints.get(mesh)!.forEach((point) => addGeometryPointMarker(mesh, point));
  }
  selectionHighlight.visible = mesh !== null;
  if (mesh) {
    setMeshSelectionHighlight(mesh, true);
    selectionHighlight.setFromObject(mesh);
    selectionHighlightMaterial.color.copy(
      eyedropperEnabled ? getObjectHighlightColor(mesh) : new THREE.Color('#f0bc62'),
    );
  }
  sceneContents.querySelectorAll<HTMLElement>('.scene-object-row').forEach((row) => {
    row.querySelector('.scene-object')?.classList.toggle('selected', row.dataset.uuid === mesh?.uuid);
  });
  if (!mesh) {
    transformReadouts = null;
    transformControls.detach();
    properties.classList.remove('properties-content');
    properties.classList.add('properties-empty');
    properties.textContent = 'Nothing selected';
    return;
  }
  updateProperties(mesh);
  if (transformMode === 'select' || isObjectLocked(mesh)) {
    transformControls.detach();
  } else if (pointEditObject === mesh) {
    transformControls.detach();
  } else {
    transformControls.setMode(transformMode);
    transformControls.attach(mesh);
  }
}

function updatePointGeometryHierarchy(mesh: THREE.Mesh) {
  const row = sceneContents.querySelector<HTMLElement>(`.scene-object-row[data-uuid="${mesh.uuid}"]`);
  const child = row?.querySelector<HTMLButtonElement>('.point-geometry-child');
  if (child) child.textContent = pointGeometryNames.get(mesh) ?? 'pointGeometryTriangleFillin';
}

function updateObjectLockControls(mesh: THREE.Mesh) {
  const row = sceneContents.querySelector<HTMLElement>(`.scene-object-row[data-uuid="${mesh.uuid}"]`);
  if (!row) return;
  const locked = isObjectLocked(mesh);
  row.classList.toggle('locked', locked);
  const lockButton = row.querySelector<HTMLButtonElement>('.object-lock-button');
  if (lockButton) {
    lockButton.hidden = !locked;
    lockButton.setAttribute('aria-pressed', String(locked));
    lockButton.setAttribute('aria-label', locked ? `Unlock ${mesh.name}` : `Lock ${mesh.name}`);
    lockButton.title = locked ? 'Unlock object' : 'Lock object';
    lockButton.innerHTML = locked
      ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v7H4z"/><path d="M8 10v2"/></svg>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 5.8-1M4 7h8v7H4z"/><path d="M8 10v2"/></svg>';
  }
}

function setObjectLocked(mesh: THREE.Mesh, locked: boolean) {
  if (locked && pointEditObject === mesh && !finishPointEditing(true)) return;
  if (locked) lockedObjects.add(mesh);
  else lockedObjects.delete(mesh);
  updateObjectLockControls(mesh);
  if (selectedObject === mesh) {
    if (locked) transformControls.detach();
    else if (transformMode !== 'select') {
      transformControls.setMode(transformMode);
      transformControls.attach(mesh);
    }
  }
}

function updateContextLockButton(mesh: THREE.Mesh) {
  const locked = isObjectLocked(mesh);
  contextLockButton.innerHTML = `${locked
    ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v7H4z"/><path d="M8 10v2"/></svg>'
    : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 5.8-1M4 7h8v7H4z"/><path d="M8 10v2"/></svg>'}<span>${locked ? 'Unlock' : 'Lock'}</span>`;
}

function showObjectContextMenu(mesh: THREE.Mesh, clientX: number, clientY: number) {
  contextTargetObject = mesh;
  selectObject(mesh);
  updateContextLockButton(mesh);
  objectContextMenu.hidden = false;
  const menuBounds = objectContextMenu.getBoundingClientRect();
  objectContextMenu.style.left = `${Math.min(clientX, window.innerWidth - menuBounds.width - 8)}px`;
  objectContextMenu.style.top = `${Math.min(clientY, window.innerHeight - menuBounds.height - 8)}px`;
}

function closeObjectContextMenu() {
  objectContextMenu.hidden = true;
  contextTargetObject = null;
}

contextLockButton.addEventListener('click', () => {
  if (!contextTargetObject) return;
  setObjectLocked(contextTargetObject, !isObjectLocked(contextTargetObject));
  updateContextLockButton(contextTargetObject);
});
contextDeleteButton.addEventListener('click', () => {
  const target = contextTargetObject;
  closeObjectContextMenu();
  if (!target) return;
  selectObject(target);
  deleteSelectedObject();
});
document.addEventListener('pointerdown', (event) => {
  if (!objectContextMenu.hidden && !objectContextMenu.contains(event.target as Node)) closeObjectContextMenu();
});

function addHierarchyRow(mesh: THREE.Mesh) {
  const row = document.createElement('div');
  row.className = 'scene-object-row';
  row.setAttribute('data-uuid', mesh.uuid);
  const line = document.createElement('div');
  line.className = 'scene-object-line';
  const pointDisclosure = document.createElement('button');
  pointDisclosure.type = 'button';
  pointDisclosure.className = 'point-geometry-disclosure';
  pointDisclosure.textContent = '›';
  pointDisclosure.setAttribute('aria-label', `Expand point geometry for ${mesh.name}`);
  pointDisclosure.hidden = !pointGeoEnabled;
  const pointChild = document.createElement('button');
  pointChild.type = 'button';
  pointChild.className = 'point-geometry-child';
  pointChild.textContent = pointGeometryNames.get(mesh) ?? 'pointGeometryTriangleFillin';
  pointChild.hidden = true;
  pointDisclosure.addEventListener('click', () => {
    pointChild.hidden = !pointChild.hidden;
    pointDisclosure.textContent = pointChild.hidden ? '›' : '⌄';
    pointDisclosure.setAttribute('aria-expanded', String(!pointChild.hidden));
  });
  pointChild.addEventListener('click', () => selectPointGeometry(mesh));
  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.className = 'scene-object';
  selectButton.textContent = mesh.name || 'Object';
  selectButton.addEventListener('click', () => selectObject(mesh));
  selectButton.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showObjectContextMenu(mesh, event.clientX, event.clientY);
  });
  const lockButton = document.createElement('button');
  lockButton.type = 'button';
  lockButton.className = 'object-lock-button';
  lockButton.addEventListener('click', () => setObjectLocked(mesh, !isObjectLocked(mesh)));
  lockButton.hidden = true;
  line.append(pointDisclosure, selectButton, lockButton);
  row.append(line, pointChild);
  sceneContents.appendChild(row);
  updateObjectLockControls(mesh);
}

function setPointGeometryEnabled(enabled: boolean) {
  pointGeoEnabled = enabled;
  pointGeoButton.setAttribute('aria-pressed', String(enabled));
  sceneContents.querySelectorAll<HTMLButtonElement>('.point-geometry-disclosure').forEach((button) => {
    button.hidden = !enabled;
  });
  if (!enabled) {
    if (pointEditObject && !finishPointEditing(true)) {
      pointGeoEnabled = true;
      pointGeoButton.setAttribute('aria-pressed', 'true');
      sceneContents.querySelectorAll<HTMLButtonElement>('.point-geometry-disclosure').forEach((button) => {
        button.hidden = false;
      });
      return;
    }
    setGeoMoveEnabled(false);
    selectedPointObject = null;
    if (selectedObject) updateProperties(selectedObject);
  }
  updatePointEditToolbar();
}

function updatePointEditToolbar() {
  const editing = pointEditObject !== null;
  addGeometryPointButton.hidden = !editing;
  addGeometryPointButton.classList.toggle('active', addingGeometryPoint);
  addButton.classList.toggle('point-edit-locked', editing);
  addButton.setAttribute('aria-disabled', String(editing));
  shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((button) => {
    button.classList.toggle('point-edit-locked', editing);
    button.setAttribute('aria-disabled', String(editing));
  });
  document.querySelectorAll<HTMLButtonElement>('.tool-button[data-mode="select"], .tool-button[data-mode="rotate"], .tool-button[data-mode="scale"]')
    .forEach((button) => {
      button.classList.toggle('point-edit-locked', editing);
      button.setAttribute('aria-disabled', String(editing));
    });
  geoMoveButton.disabled = !editing;
  geoMoveButton.setAttribute('aria-pressed', String(geoMoveEnabled));
  if (lastCursorEvent) updateCursorAppearance(lastCursorEvent);
}

function setGeoMoveEnabled(enabled: boolean) {
  geoMoveEnabled = enabled && pointEditObject !== null;
  geoMoveButton.setAttribute('aria-pressed', String(geoMoveEnabled));
  if (!geoMoveEnabled) transformControls.detach();
  else if (selectedGeometryPoints.length > 0) setGeometryPointSelection(selectedGeometryPoints);
  if (selectedPointObject) updatePointGeometryProperties(selectedPointObject);
  updatePointEditToolbar();
}

function placePointOnSurface(event: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Vector3 | null {
  if (!pointEditObject) return null;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  pointEditObject.updateWorldMatrix(true, false);
  const planeNormal = camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    planeNormal,
    pointEditObject.getWorldPosition(new THREE.Vector3()),
  );
  const worldPoint = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  return worldPoint ? pointEditObject.worldToLocal(worldPoint) : null;
}

function getGeometryPointAtPointer(event: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Mesh | null {
  if (!pointEditObject) return null;
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointerX = event.clientX;
  const pointerY = event.clientY;
  const pointWorldPosition = new THREE.Vector3();
  let closestMarker: THREE.Mesh | null = null;
  let closestDistance = 15;
  let closestDepth = Number.POSITIVE_INFINITY;
  for (const marker of geometryPointMarkers) {
    marker.getWorldPosition(pointWorldPosition);
    const depth = camera.position.distanceTo(pointWorldPosition);
    pointWorldPosition.project(camera);
    const screenX = bounds.left + (pointWorldPosition.x + 1) * bounds.width * 0.5;
    const screenY = bounds.top + (1 - pointWorldPosition.y) * bounds.height * 0.5;
    const screenDistance = Math.hypot(pointerX - screenX, pointerY - screenY);
    if (screenDistance < closestDistance || (screenDistance === closestDistance && depth < closestDepth)) {
      closestDistance = screenDistance;
      closestDepth = depth;
      closestMarker = marker;
    }
  }
  return closestMarker;
}

function captureGeometryPointSelectionStart() {
  pointSelectionStartWorld.clear();
  pointSelectionStartCenter.set(0, 0, 0);
  if (selectedGeometryPoints.length === 0) return;
  let count = 0;
  for (const marker of selectedGeometryPoints) {
    marker.updateWorldMatrix(true, false);
    const worldPosition = marker.getWorldPosition(new THREE.Vector3());
    pointSelectionStartWorld.set(marker, worldPosition);
    pointSelectionStartCenter.add(worldPosition);
    count++;
  }
  pointSelectionStartCenter.divideScalar(count);
}

function updatePointGeometryPreview() {
  if (pointPreviewFrame !== null) cancelAnimationFrame(pointPreviewFrame);
  pointPreviewFrame = requestAnimationFrame(() => {
    pointPreviewFrame = null;
    const mesh = pointEditObject;
    const points = mesh ? pointGeometryPoints.get(mesh) : undefined;
    if (!mesh || !points || points.length < 4) return;
    const geometry = new ConvexGeometry(points);
    const positions = geometry.getAttribute('position');
    if (positions.count < 12) {
      geometry.dispose();
      return;
    }
    const previousGeometry = mesh.geometry;
    mesh.geometry = geometry;
    previousGeometry.dispose();
    selectionHighlight.update();
  });
}

function setGeometryPointSelection(markers: THREE.Mesh[]) {
  for (const marker of geometryPointMarkers) {
    (marker.material as THREE.MeshBasicMaterial).color.set('#ffe36b');
  }
  selectedGeometryPoints = [...new Set(markers)].filter((marker) => geometryPointMarkers.includes(marker));
  for (const marker of selectedGeometryPoints) {
    (marker.material as THREE.MeshBasicMaterial).color.set('#ff3b3b');
  }
  if (selectedGeometryPoints.length > 0 && (geoMoveEnabled || transformMode === 'translate')) {
    captureGeometryPointSelectionStart();
    pointSelectionGizmo.position.copy(pointSelectionStartCenter);
    pointSelectionGizmo.rotation.set(0, 0, 0);
    pointSelectionGizmo.scale.set(1, 1, 1);
    pointSelectionGizmo.updateMatrixWorld(true);
    transformControls.setMode('translate');
    transformControls.attach(pointSelectionGizmo);
  } else {
    pointSelectionStartWorld.clear();
    transformControls.detach();
  }
}

function finishGeometryPointDrag() {
  pointInteractionLocked = false;
  syncNavigationControls();
}

function getEditablePoints(mesh: THREE.Mesh): THREE.Vector3[] {
  const existing = pointGeometryPoints.get(mesh);
  if (existing) return existing.map((point) => point.clone());
  const base = shapeDefinitions[objectShapes.get(mesh)!].createBaseGeometry();
  const positions = base.getAttribute('position');
  const points: THREE.Vector3[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < positions.count; index++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, index);
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(point);
  }
  base.dispose();
  return points;
}

function clearGeometryPointMarkers() {
  if (transformControls.object === pointSelectionGizmo) transformControls.detach();
  geometryPointMarkers.forEach((marker) => {
    marker.parent?.remove(marker);
    marker.geometry.dispose();
    (marker.material as THREE.Material).dispose();
  });
  geometryPointMarkers = [];
  selectedGeometryPoints = [];
  pointSelectionStartWorld.clear();
}

function addGeometryPointMarker(parent: THREE.Mesh, point: THREE.Vector3) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ffe36b', depthTest: false }),
  );
  marker.userData.isGeometryPoint = true;
  marker.position.copy(point);
  marker.renderOrder = 1000;
  parent.add(marker);
  geometryPointMarkers.push(marker);
}

function updateGeometryPointMarkerScale() {
  for (const marker of geometryPointMarkers) {
    marker.getWorldPosition(pointMarkerWorldPosition);
    const distance = camera.position.distanceTo(pointMarkerWorldPosition);
    const scale = THREE.MathUtils.clamp(distance / 12, 0.35, 1.4);
    marker.scale.setScalar(scale);
  }
}

function selectPointGeometry(mesh: THREE.Mesh) {
  if (isObjectLocked(mesh)) return;
  if (pointEditObject && pointEditObject !== mesh && !finishPointEditing(true)) return;
  selectObject(mesh);
  selectedPointObject = mesh;
  updatePointGeometryProperties(mesh);
}

function beginPointEditing(mesh: THREE.Mesh) {
  if (isObjectLocked(mesh)) return;
  if (pointEditObject && pointEditObject !== mesh && !finishPointEditing(true)) return;
  manualPointSelectionEnabled = false;
  pointEditObject = mesh;
  selectedPointObject = mesh;
  pointEditTriangleCount = Math.max(1, Math.floor(mesh.geometry.getAttribute('position').count / 3));
  const points = getEditablePoints(mesh);
  pointGeometryPoints.set(mesh, points);
  clearGeometryPointMarkers();
  points.forEach((point) => addGeometryPointMarker(mesh, point));
  addingGeometryPoint = false;
  transformControls.detach();
  syncNavigationControls();
  updatePointEditToolbar();
  updatePointGeometryProperties(mesh);
}

function rebuildPointGeometry(mesh: THREE.Mesh) {
  const points = pointGeometryPoints.get(mesh);
  if (!points || points.length < 4) {
    if (pointStatusElement) pointStatusElement.textContent = 'Add at least four points to create a filled surface.';
    return false;
  }
  const hull = new ConvexGeometry(points);
  const positions = hull.getAttribute('position');
  if (positions.count < 12) {
    hull.dispose();
    if (pointStatusElement) pointStatusElement.textContent = 'These points do not enclose a 3D shape. Add points in different directions.';
    return false;
  }
  const shape = objectShapes.get(mesh);
  if (!shape) {
    hull.dispose();
    throw new Error(`The shape type for "${mesh.name}" was not found.`);
  }
  const faces = Math.max(
    shapeDefinitions[shape].minimumTriangles,
    pointEditTriangleCount || Math.floor(mesh.geometry.getAttribute('position').count / 3),
  );
  const nextGeometry = createTriangleGeometry(shape, faces, hull);
  hull.dispose();
  const previousGeometry = mesh.geometry;
  mesh.geometry = nextGeometry;
  previousGeometry.dispose();
  pointGeometryPoints.set(mesh, points.map((point) => point.clone()));
  selectionHighlight.update();
  if (pointStatusElement) pointStatusElement.textContent = 'Point geometry saved.';
  return true;
}

function finishPointEditing(save: boolean) {
  const mesh = pointEditObject;
  if (!mesh) return true;
  if (pointPreviewFrame !== null) {
    cancelAnimationFrame(pointPreviewFrame);
    pointPreviewFrame = null;
  }
  if (save && !rebuildPointGeometry(mesh)) return false;
  transformControls.detach();
  manualPointSelectionEnabled = false;
  setGeometryPointSelection([]);
  pointEditObject = null;
  pointEditTriangleCount = 0;
  selectedGeometryPoints = [];
  pointSelectionStartWorld.clear();
  addingGeometryPoint = false;
  geoMoveEnabled = false;
  syncNavigationControls();
  pointStatusElement = null;
  updatePointEditToolbar();
  if (selectedObject === mesh) {
    selectedPointObject = null;
    updateProperties(mesh);
    if (transformMode !== 'select' && !isObjectLocked(mesh)) {
      transformControls.setMode(transformMode);
      transformControls.attach(mesh);
    }
  }
  return true;
}

function updatePointGeometryProperties(mesh: THREE.Mesh) {
  properties.classList.remove('properties-empty');
  properties.classList.add('properties-content');
  properties.replaceChildren();
  const form = document.createElement('div');
  form.className = 'properties-form';
  const label = document.createElement('label');
  label.className = 'property-field';
  label.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = pointGeometryNames.get(mesh) ?? 'pointGeometryTriangleFillin';
  nameInput.setAttribute('aria-label', 'Point geometry name');
  nameInput.addEventListener('input', () => {
    const name = nameInput.value || 'pointGeometryTriangleFillin';
    pointGeometryNames.set(mesh, name);
    updatePointGeometryHierarchy(mesh);
  });
  label.appendChild(nameInput);
  if (pointEditObject !== mesh) {
    const configure = document.createElement('button');
    configure.type = 'button';
    configure.className = 'configure-points-button';
    configure.textContent = 'Configure points';
    configure.disabled = isObjectLocked(mesh);
    configure.addEventListener('click', () => beginPointEditing(mesh));
    form.append(label, configure);
  } else {
    form.appendChild(label);
  }
  if (pointEditObject === mesh) {
    const status = document.createElement('div');
    status.className = 'point-geometry-status';
    pointStatusElement = status;
    status.textContent = `${pointGeometryPoints.get(mesh)?.length ?? 0} points configured. Select points and use the Move gizmo to reposition them freely.`;
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'configure-points-button';
    exit.textContent = 'Exit and save';
    exit.addEventListener('click', () => finishPointEditing(true));
    form.append(status, exit);
  } else {
    pointStatusElement = null;
  }
  properties.appendChild(form);
}

function addObject(name: string, position: THREE.Vector3) {
  const definition = shapeDefinitions[name];
  if (!definition) throw new Error(`Unknown shape "${name}".`);
  const material = new THREE.MeshStandardMaterial({ color: '#aeb7bd', roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(
    createTriangleGeometry(name, definition.minimumTriangles),
    material,
  );
  mesh.name = name;
  objectShapes.set(mesh, name);
  objectMaterialPresets.set(mesh, 'Rubber');
  mesh.position.copy(position);
  mesh.position.y += definition.groundOffset;
  scene.add(mesh);
  objects.push(mesh);
  addHierarchyRow(mesh);
  selectObject(mesh);
}

function uniqueObjectName(baseName: string): string {
  const existingNames = new Set(objects.map((mesh) => mesh.name));
  if (!existingNames.has(baseName)) return baseName;
  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`)) suffix += 1;
  return `${baseName} ${suffix}`;
}

function cloneSelectedObject() {
  if (!selectedObject) return;
  const source = selectedObject;
  const sourceMaterial = source.material;
  if (!(sourceMaterial instanceof THREE.MeshStandardMaterial)) {
    throw new Error(`Cannot clone the material for "${source.name}".`);
  }
  const cloneMaterial = sourceMaterial.clone();
  const sourceEmissive = originalEmissive.get(source);
  if (sourceEmissive) {
    cloneMaterial.emissive.copy(sourceEmissive.color);
    cloneMaterial.emissiveIntensity = sourceEmissive.intensity;
  }
  const clone = new THREE.Mesh(source.geometry.clone(), cloneMaterial);
  clone.name = uniqueObjectName(`${source.name} Copy`);
  clone.position.copy(source.position);
  clone.rotation.copy(source.rotation);
  clone.scale.copy(source.scale);
  source.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(source);
  clone.position.x += bounds.getSize(new THREE.Vector3()).x + 0.1;
  objectShapes.set(clone, objectShapes.get(source)!);
  objectMaterialPresets.set(clone, objectMaterialPresets.get(source) ?? 'Rubber');
  const savedPoints = pointGeometryPoints.get(source);
  if (savedPoints) pointGeometryPoints.set(clone, savedPoints.map((point) => point.clone()));
  const savedPointName = pointGeometryNames.get(source);
  if (savedPointName) pointGeometryNames.set(clone, savedPointName);
  scene.add(clone);
  objects.push(clone);
  addHierarchyRow(clone);
  selectObject(clone);
}

function deleteSelectedObject() {
  if (!selectedObject) return;
  if (pointEditObject === selectedObject) finishPointEditing(false);
  clearGeometryPointMarkers();
  setEyedropperEnabled(false);
  const mesh = selectedObject;
  const topologyTimer = topologyUpdateTimers.get(mesh);
  if (topologyTimer !== undefined) window.clearTimeout(topologyTimer);
  transformControls.detach();
  scene.remove(mesh);
  const objectIndex = objects.indexOf(mesh);
  if (objectIndex >= 0) objects.splice(objectIndex, 1);
  sceneContents.querySelector(`.scene-object-row[data-uuid="${mesh.uuid}"]`)?.remove();
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
  else mesh.material.dispose();
  hoverHighlight.visible = false;
  selectObject(null);
}

function setPlacementMode(shape: string | null) {
  if (shape) setEyedropperEnabled(false);
  if (shape && pointEditObject && !finishPointEditing(true)) return;
  if (shape && pointGeoEnabled) setPointGeometryEnabled(false);
  placementShape = shape;
  toolbar.classList.toggle('is-placement-locked', shape !== null);
  sidebar.classList.toggle('is-placement-locked', shape !== null);

  if (shape) {
    transformControls.detach();
  }

  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    (previewMesh.material as THREE.Material).dispose();
    previewMesh = null;
  }

  if (shape) {
    const definition = shapeDefinitions[shape];
    const previewColor = selectedObject?.material instanceof THREE.MeshStandardMaterial
      ? selectedObject.material.color
      : new THREE.Color('#d7d7d7');
    previewMesh = new THREE.Mesh(
      createTriangleGeometry(shape, definition.minimumTriangles),
      new THREE.MeshStandardMaterial({
        color: previewColor,
        transparent: true,
        opacity: 0.45,
        roughness: 0.65,
        depthWrite: false,
      }),
    );
    placementPosition.set(0, definition.groundOffset, 0);
    previewMesh.position.copy(placementPosition);
    scene.add(previewMesh);
  } else if (selectedObject && transformMode !== 'select' && !isObjectLocked(selectedObject)) {
    transformControls.setMode(transformMode);
    transformControls.attach(selectedObject);
  }
  if (lastCursorEvent) updateCursorAppearance(lastCursorEvent);
}

addButton.addEventListener('click', () => {
  if (pointEditObject) return;
  const isOpen = addButton.getAttribute('aria-expanded') === 'true';
  addButton.setAttribute('aria-expanded', String(!isOpen));
  shapeMenu.hidden = isOpen;
});

shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((button) => {
  button.addEventListener('click', () => {
    if (pointEditObject) return;
    const shape = button.dataset.shape;
    if (!shape || !shapeDefinitions[shape]) return;
    shapeMenu.hidden = true;
    addButton.setAttribute('aria-expanded', 'false');
    setPlacementMode(shape);
  });
});

sceneDisclosure.addEventListener('click', () => {
  const expanded = sceneDisclosure.getAttribute('aria-expanded') === 'true';
  sceneDisclosure.setAttribute('aria-expanded', String(!expanded));
  sceneDisclosure.querySelector('.chevron')!.textContent = expanded ? '›' : '⌄';
  sceneContents.hidden = expanded;
});

document.querySelectorAll<HTMLButtonElement>('.tool-button').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode as TransformMode | undefined;
    if (!mode) return;
    if (pointEditObject && mode !== 'translate') return;
    if (pointEditObject && mode === 'translate') setGeoMoveEnabled(true);
    setEyedropperEnabled(false);
    transformMode = mode;
    document.querySelectorAll('.tool-button').forEach((tool) => {
      tool.classList.remove('active');
      tool.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    if (selectedObject) {
      if (pointEditObject === selectedObject) {
        if (selectedGeometryPoints.length > 0) setGeometryPointSelection(selectedGeometryPoints);
        else transformControls.detach();
      } else if (mode === 'select' || isObjectLocked(selectedObject)) {
        transformControls.detach();
      } else {
        transformControls.setMode(mode);
        transformControls.attach(selectedObject);
      }
    }
  });
});

function updatePlacementPoint(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
  if (!placementShape || !previewMesh) return;
  lastPointerPosition.set(event.clientX, event.clientY);
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const surfaceHit = raycaster.intersectObjects(objects, false)[0];
  if (surfaceHit?.face) {
    const normal = surfaceHit.face.normal.clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(surfaceHit.object.matrixWorld))
      .normalize();
    const support = getMeshSupport(previewMesh, normal);
    placementPosition.copy(surfaceHit.point).addScaledVector(normal, support + 0.001);
    if (snappingEnabled) snapPlacementPosition(placementPosition, shapeDefinitions[placementShape].groundOffset);
    previewMesh.position.copy(placementPosition);
    return;
  }

  const hit = raycaster.ray.intersectPlane(placementPlane, new THREE.Vector3());
  if (!hit) return;
  const groundOffset = shapeDefinitions[placementShape].groundOffset;
  placementPosition.set(hit.x, groundOffset, hit.z);
  if (snappingEnabled) snapPlacementPosition(placementPosition, groundOffset);
  previewMesh.position.copy(placementPosition);
}

function getMeshSupport(mesh: THREE.Mesh, direction: THREE.Vector3): number {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  if (!bounds) throw new Error(`Geometry bounds for "${mesh.name || 'preview'}" could not be computed.`);
  let support = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z)
          .multiply(mesh.scale)
          .applyQuaternion(mesh.quaternion);
        support = Math.max(support, Math.abs(corner.dot(direction)));
      }
    }
  }
  return support;
}

function snapPlacementPosition(position: THREE.Vector3, groundOffset: number) {
  const step = 0.5;
  position.x = Math.round(position.x / step) * step;
  position.y = groundOffset + Math.round((position.y - groundOffset) / step) * step;
  position.z = Math.round(position.z / step) * step;
}

function setSnappingEnabled(enabled: boolean) {
  snappingEnabled = enabled;
  snapButton.setAttribute('aria-pressed', String(enabled));
  transformControls.setTranslationSnap(enabled ? 1 : null);
  transformControls.setRotationSnap(enabled ? THREE.MathUtils.degToRad(15) : null);
  transformControls.setScaleSnap(enabled ? 0.25 : null);
}

snapButton.addEventListener('click', () => setSnappingEnabled(!snappingEnabled));

renderer.domElement.addEventListener('pointermove', (event) => {
  updatePlacementPoint(event);
  updateEyedropperHover(event);
});
renderer.domElement.addEventListener('pointerleave', () => {
  hoverHighlight.visible = false;
});
let selectionPointerStart: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!placementShape || event.button !== 0) return;
  updatePlacementPoint(event);
  const shape = placementShape;
  addObject(shape, placementPosition.clone().setY(placementPosition.y - shapeDefinitions[shape].groundOffset));
  setPlacementMode(null);
  placementJustCommitted = true;
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!addingGeometryPoint || !pointEditObject || event.button !== 0) return;
  event.stopImmediatePropagation();
  pointInteractionLocked = true;
  syncNavigationControls();
  const mesh = pointEditObject;
  const localPoint = placePointOnSurface(event);
  if (!localPoint) {
    if (pointStatusElement) pointStatusElement.textContent = 'Point could not be placed on the view plane.';
    return;
  }
  const points = pointGeometryPoints.get(mesh);
  if (!points) throw new Error('Point geometry data is unavailable while adding a point.');
  points.push(localPoint.clone());
  addGeometryPointMarker(mesh, localPoint);
  addingGeometryPoint = false;
  updatePointEditToolbar();
  updatePointGeometryProperties(mesh);
  event.preventDefault();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!pointEditObject || isObjectLocked(pointEditObject) || event.button !== 0 ||
    (!manualPointSelectionEnabled && !geoMoveEnabled && transformMode !== 'translate')) return;
  if (transformControls.dragging) return;
  pointInteractionLocked = true;
  syncNavigationControls();
  const point = getGeometryPointAtPointer(event);
  if (!point) {
    if (manualPointSelectionEnabled) {
      setGeometryPointSelection([]);
      if (pointStatusElement) pointStatusElement.textContent = 'No points selected. Click points to select them.';
    }
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
  if (manualPointSelectionEnabled) {
    const nextSelection = selectedGeometryPoints.includes(point)
      ? selectedGeometryPoints.filter((selectedPoint) => selectedPoint !== point)
      : [...selectedGeometryPoints, point];
    setGeometryPointSelection(nextSelection);
  } else {
    setGeometryPointSelection([point]);
  }
  if (manualPointSelectionEnabled && pointStatusElement) {
    pointStatusElement.textContent = `${selectedGeometryPoints.length} point${selectedGeometryPoints.length === 1 ? '' : 's'} selected. Move the selection with the gizmo.`;
  }
  event.stopImmediatePropagation();
  event.preventDefault();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (placementShape || placementJustCommitted || pointEditObject || addingGeometryPoint || event.button !== 0) {
    selectionPointerStart = null;
    placementJustCommitted = false;
    return;
  }
  selectionPointerStart = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!selectionPointerStart) return;
  if (placementShape || isTransformDragging) {
    selectionPointerStart = null;
    return;
  }
  const movedX = event.clientX - selectionPointerStart.x;
  const movedY = event.clientY - selectionPointerStart.y;
  selectionPointerStart = null;
  if (Math.hypot(movedX, movedY) > 4) return;

  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  if (pointEditObject) {
    setGeometryPointSelection([]);
    return;
  }
  const [hit] = raycaster.intersectObjects(objects, false);
  if (eyedropperEnabled) {
    const sampledObject = hit?.object instanceof THREE.Mesh ? hit.object : null;
    if (!sampledObject || isObjectLocked(sampledObject)) return;
    const sampledMaterial = sampledObject.material;
    if (!(sampledMaterial instanceof THREE.MeshStandardMaterial)) {
      throw new Error(`Cannot sample color from "${sampledObject.name}".`);
    }
    if (!eyedropperColor) {
      eyedropperColor = sampledMaterial.color.clone();
      eyedropperButton.textContent = `Painting #${eyedropperColor.getHexString()}…`;
      recordRecentColor(eyedropperColor);
      selectObject(sampledObject);
      return;
    }
    sampledMaterial.color.copy(eyedropperColor);
    recordRecentColor(eyedropperColor);
    eyedropperButton.textContent = `Painting #${eyedropperColor.getHexString()}…`;
    selectObject(sampledObject);
    return;
  }
  selectObject(hit?.object instanceof THREE.Mesh ? hit.object : null);
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const isEditingText = target instanceof HTMLElement &&
    (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement);
  if (isEditingText) return;

  if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
    (event.code === 'Backquote' || event.key === '`')) {
    event.preventDefault();
    setFreeCameraEnabled(!freeCameraEnabled);
    return;
  }
  if (event.repeat) return;

  if (freeCameraEnabled &&
    ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
    event.preventDefault();
    freeCameraKeys.add(event.code);
    return;
  }

  if (pointEditObject && event.altKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    manualPointSelectionEnabled = !manualPointSelectionEnabled;
    setGeoMoveEnabled(true);
    transformMode = 'translate';
    document.querySelectorAll<HTMLButtonElement>('.tool-button').forEach((button) => {
      const active = button.dataset.mode === 'translate';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!manualPointSelectionEnabled) setGeometryPointSelection([]);
    if (pointStatusElement) {
      pointStatusElement.textContent = manualPointSelectionEnabled
        ? 'Manual point selection enabled. Click points to add or remove them from the selection, then move them with the gizmo.'
        : 'Manual point selection disabled.';
    }
    return;
  }

  if (pointEditObject && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    manualPointSelectionEnabled = false;
    setGeoMoveEnabled(true);
    transformMode = 'translate';
    document.querySelectorAll<HTMLButtonElement>('.tool-button').forEach((button) => {
      const active = button.dataset.mode === 'translate';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    setGeometryPointSelection(geometryPointMarkers);
    if (pointStatusElement) {
      pointStatusElement.textContent = `${selectedGeometryPoints.length} points selected. Move the selection with the gizmo.`;
    }
    return;
  }

  if (event.key === 'Escape' && eyedropperEnabled) {
    setEyedropperEnabled(false);
    return;
  }
  if (event.key === 'Escape' && !objectContextMenu.hidden) {
    closeObjectContextMenu();
    return;
  }
  if (event.key === 'Escape' && freeCameraEnabled) {
    setFreeCameraEnabled(false);
    return;
  }

  if (!placementShape && (event.key === 'Delete' || event.key === 'Backspace') && selectedObject) {
    event.preventDefault();
    deleteSelectedObject();
    return;
  }
  if (!placementShape && (event.ctrlKey || event.metaKey) &&
    !event.shiftKey && event.key.toLowerCase() === 'z' && selectedObject) {
    event.preventDefault();
    cloneSelectedObject();
    return;
  }

  if (event.key.toLowerCase() === 'q') {
    event.preventDefault();
    setSnappingEnabled(!snappingEnabled);
    if (placementShape) updatePlacementPoint({
      clientX: lastPointerPosition.x,
      clientY: lastPointerPosition.y,
    });
    return;
  }
  if (!placementShape) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    addObject(placementShape, new THREE.Vector3(0, 0, 0));
    setPlacementMode(null);
  } else if (event.key === 'Escape') {
    setPlacementMode(null);
  }
});

window.addEventListener('keyup', (event) => {
  freeCameraKeys.delete(event.code);
});

function resizeViewport() {
  const { clientWidth, clientHeight } = viewport;
  if (clientWidth === 0 || clientHeight === 0) return;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
}

const resizeObserver = new ResizeObserver(resizeViewport);
resizeObserver.observe(viewport);

let resizingSidebar = false;
sidebarResize.addEventListener('pointerdown', (event) => {
  resizingSidebar = true;
  sidebarResize.setPointerCapture(event.pointerId);
  event.preventDefault();
});
sidebarResize.addEventListener('pointermove', (event) => {
  if (!resizingSidebar) return;
  const sidebarWidth = THREE.MathUtils.clamp(
    sidebar.getBoundingClientRect().right - event.clientX,
    180,
    window.innerWidth * 0.55,
  );
  sidebar.style.width = `${sidebarWidth}px`;
  sidebar.style.flexBasis = `${sidebarWidth}px`;
  sidebarResize.setAttribute('aria-valuenow', String(Math.round(sidebarWidth)));
});
sidebarResize.addEventListener('pointerup', () => {
  resizingSidebar = false;
});
sidebarResize.addEventListener('pointercancel', () => {
  resizingSidebar = false;
});
sidebarResize.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const direction = event.key === 'ArrowLeft' ? 1 : -1;
  const width = THREE.MathUtils.clamp(sidebar.clientWidth + direction * 20, 180, window.innerWidth * 0.55);
  sidebar.style.width = `${width}px`;
  sidebar.style.flexBasis = `${width}px`;
  sidebarResize.setAttribute('aria-valuenow', String(Math.round(width)));
});

function setHierarchyPanelHeight(clientY: number) {
  const bounds = sidebar.getBoundingClientRect();
  const percent = THREE.MathUtils.clamp((clientY - bounds.top) / bounds.height, 0.15, 0.85) * 100;
  hierarchyPanel.style.flex = `0 0 ${percent}%`;
  propertiesPanel.style.flex = '1 1 0';
  panelResize.setAttribute('aria-valuenow', String(Math.round(percent)));
}
let resizingPanels = false;
panelResize.addEventListener('pointerdown', (event) => {
  resizingPanels = true;
  panelResize.setPointerCapture(event.pointerId);
  setHierarchyPanelHeight(event.clientY);
  event.preventDefault();
});
panelResize.addEventListener('pointermove', (event) => {
  if (resizingPanels) setHierarchyPanelHeight(event.clientY);
});
panelResize.addEventListener('pointerup', () => {
  resizingPanels = false;
});
panelResize.addEventListener('pointercancel', () => {
  resizingPanels = false;
});
panelResize.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  const bounds = hierarchyPanel.getBoundingClientRect();
  const delta = event.key === 'ArrowUp' ? -20 : 20;
  setHierarchyPanelHeight(bounds.bottom + delta);
});

function render() {
  const now = performance.now();
  const deltaSeconds = Math.min((now - previousFrameTime) / 1000, 0.05);
  previousFrameTime = now;
  if (freeCameraEnabled && freeCameraKeys.size > 0) {
    const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const movement = new THREE.Vector3();
    if (freeCameraKeys.has('KeyW')) movement.add(forward);
    if (freeCameraKeys.has('KeyS')) movement.sub(forward);
    if (freeCameraKeys.has('KeyD')) movement.add(right);
    if (freeCameraKeys.has('KeyA')) movement.sub(right);
    if (freeCameraKeys.has('Space')) movement.y += 1;
    if (freeCameraKeys.has('KeyC')) movement.y -= 1;
    if (movement.lengthSq() > 0) {
      movement.normalize();
      const speed = freeCameraKeys.has('ShiftLeft') || freeCameraKeys.has('ShiftRight') ? 24 : 8;
      camera.position.addScaledVector(movement, speed * deltaSeconds);
    }
  }
  controls.update();
  if (selectedObject && selectionHighlight.visible) selectionHighlight.update();
  updateGeometryPointMarkerScale();
  grid.position.x = camera.position.x;
  grid.position.z = camera.position.z;
  gridMaterial.uniforms.uCameraPosition.value.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

let previousFrameTime = performance.now();
render();
