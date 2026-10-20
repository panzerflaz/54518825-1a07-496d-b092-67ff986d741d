import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import './style.css';

const viewportElement = document.querySelector<HTMLDivElement>('#viewport');
const toolbarElement = document.querySelector<HTMLDivElement>('.toolbar');
const sidebarElement = document.querySelector<HTMLElement>('.sidebar');
const addButtonElement = document.querySelector<HTMLButtonElement>('.add-button');
const shapeMenuElement = document.querySelector<HTMLDivElement>('#shape-menu');
const sceneContentsElement = document.querySelector<HTMLDivElement>('#scene-contents');
const sceneDisclosureElement = document.querySelector<HTMLButtonElement>('.scene-root');
const propertiesElement = document.querySelector<HTMLDivElement>('.properties-empty');
const distanceInputElement = document.querySelector<HTMLInputElement>('#render-distance');
const distanceOutputElement = document.querySelector<HTMLOutputElement>('#render-distance-value');
const customCursorElement = document.querySelector<HTMLDivElement>('#custom-cursor');

if (!viewportElement || !toolbarElement || !sidebarElement || !addButtonElement || !shapeMenuElement ||
  !sceneContentsElement || !sceneDisclosureElement || !propertiesElement ||
  !distanceInputElement || !distanceOutputElement || !customCursorElement) {
  throw new Error('One or more editor interface elements could not be found.');
}

const viewport = viewportElement;
const toolbar = toolbarElement;
const sidebar = sidebarElement;
const addButton = addButtonElement;
const shapeMenu = shapeMenuElement;
const sceneContents = sceneContentsElement;
const sceneDisclosure = sceneDisclosureElement;
const properties = propertiesElement;
const distanceInput = distanceInputElement;
const distanceOutput = distanceOutputElement;
const customCursor = customCursorElement;

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
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
let isOrbitDragging = false;
window.addEventListener('pointermove', (event) => {
  customCursor.style.left = `${event.clientX}px`;
  customCursor.style.top = `${event.clientY}px`;
  if (isOrbitDragging) customCursor.classList.add('spinning');
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button === 2) {
    isOrbitDragging = true;
  }
});
window.addEventListener('pointerup', (event) => {
  if (event.button === 2) {
    isOrbitDragging = false;
    customCursor.classList.remove('spinning');
  }
});
window.addEventListener('blur', () => {
  isOrbitDragging = false;
  customCursor.classList.remove('spinning');
});

type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());
let transformMode: TransformMode = 'select';
let isTransformDragging = false;
let selectedObject: THREE.Mesh | null = null;
let transformReadouts: { position: HTMLDivElement; rotation: HTMLDivElement; scale: HTMLDivElement } | null = null;
transformControls.addEventListener('dragging-changed', () => {
  isTransformDragging = transformControls.dragging;
  controls.enabled = !transformControls.dragging;
});
transformControls.addEventListener('objectChange', () => {
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

function createTriangleGeometry(shape: string, targetCount: number): THREE.BufferGeometry {
  const definition = shapeDefinitions[shape];
  const sourceGeometry = definition.createBaseGeometry().toNonIndexed();
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

  while (triangles.length < targetCount) {
    let splitIndex = 0;
    let splitEdge: [keyof Triangle, keyof Triangle] = ['a', 'b'];
    let longestEdge = -1;
    for (let index = 0; index < triangles.length; index++) {
      const triangle = triangles[index];
      const edges: Array<[keyof Triangle, keyof Triangle]> = [['a', 'b'], ['b', 'c'], ['c', 'a']];
      for (const edge of edges) {
        const length = triangle[edge[0]].distanceToSquared(triangle[edge[1]]);
        if (length > longestEdge) {
          longestEdge = length;
          splitIndex = index;
          splitEdge = edge;
        }
      }
    }

    const triangle = triangles[splitIndex];
    const [startKey, endKey] = splitEdge;
    const thirdKey = (['a', 'b', 'c'] as const).find((key) => key !== startKey && key !== endKey)!;
    const midpoint = triangle[startKey].clone().add(triangle[endKey]).multiplyScalar(0.5);
    const projectedMidpoint = definition.projectToSurface(midpoint);
    const first: Triangle = { a: triangle.a.clone(), b: triangle.b.clone(), c: triangle.c.clone() };
    const second: Triangle = { a: triangle.a.clone(), b: triangle.b.clone(), c: triangle.c.clone() };
    first[startKey] = projectedMidpoint.clone();
    second[endKey] = projectedMidpoint.clone();
    first[thirdKey] = triangle[thirdKey].clone();
    second[thirdKey] = triangle[thirdKey].clone();
    triangles[splitIndex] = first;
    triangles.push(second);
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
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let placementShape: string | null = null;
let previewMesh: THREE.Mesh | null = null;
let placementPosition = new THREE.Vector3(0, 0, 0);

function updateProperties(mesh: THREE.Mesh) {
  properties.classList.remove('properties-empty');
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
    sceneContents.querySelectorAll<HTMLButtonElement>('.scene-object').forEach((row) => {
      if (row.dataset.uuid === mesh.uuid) row.textContent = mesh.name || 'Object';
    });
  });
  nameLabel.appendChild(nameInput);

  const shape = objectShapes.get(mesh);
  if (!shape) throw new Error(`The shape type for "${mesh.name}" was not found.`);
  const definition = shapeDefinitions[shape];
  const triangleLabel = document.createElement('label');
  triangleLabel.className = 'property-field';
  triangleLabel.textContent = 'Triangles';
  const triangleInput = document.createElement('input');
  triangleInput.type = 'number';
  triangleInput.min = String(definition.minimumTriangles);
  triangleInput.max = '10000';
  triangleInput.step = '1';
  triangleInput.value = String(mesh.geometry.getAttribute('position').count / 3);
  triangleInput.setAttribute('aria-label', 'Triangle count');
  triangleInput.addEventListener('change', () => {
    const requested = Number(triangleInput.value);
    if (!Number.isFinite(requested)) {
      triangleInput.value = String(mesh.geometry.getAttribute('position').count / 3);
      return;
    }
    const triangleCount = THREE.MathUtils.clamp(
      Math.floor(requested),
      definition.minimumTriangles,
      10000,
    );
    triangleInput.value = String(triangleCount);
    const previousGeometry = mesh.geometry;
    mesh.geometry = createTriangleGeometry(shape, triangleCount);
    previousGeometry.dispose();
  });
  triangleLabel.appendChild(triangleInput);

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

  form.append(nameLabel, triangleLabel, position, rotation, scale);
  properties.appendChild(form);
}

function selectObject(mesh: THREE.Mesh | null) {
  selectedObject = mesh;
  sceneContents.querySelectorAll('.scene-object').forEach((row) => {
    row.classList.toggle('selected', row.getAttribute('data-uuid') === mesh?.uuid);
  });
  if (!mesh) {
    transformReadouts = null;
    transformControls.detach();
    properties.classList.add('properties-empty');
    properties.textContent = 'Nothing selected';
    return;
  }
  updateProperties(mesh);
  if (transformMode === 'select') {
    transformControls.detach();
  } else {
    transformControls.setMode(transformMode);
    transformControls.attach(mesh);
  }
}

function addObject(name: string, position: THREE.Vector3) {
  const definition = shapeDefinitions[name];
  if (!definition) throw new Error(`Unknown shape "${name}".`);
  const mesh = new THREE.Mesh(
    createTriangleGeometry(name, definition.minimumTriangles),
    new THREE.MeshStandardMaterial({ color: '#aeb7bd', roughness: 0.62, metalness: 0.12 }),
  );
  mesh.name = name;
  objectShapes.set(mesh, name);
  mesh.position.copy(position);
  mesh.position.y += definition.groundOffset;
  scene.add(mesh);
  objects.push(mesh);

  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'scene-object';
  row.textContent = name;
  row.setAttribute('data-uuid', mesh.uuid);
  row.addEventListener('click', () => selectObject(mesh));
  sceneContents.appendChild(row);
  selectObject(mesh);
}

function setPlacementMode(shape: string | null) {
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
    previewMesh = new THREE.Mesh(
      createTriangleGeometry(shape, definition.minimumTriangles),
      new THREE.MeshStandardMaterial({
        color: '#d7d7d7',
        transparent: true,
        opacity: 0.45,
        roughness: 0.65,
        depthWrite: false,
      }),
    );
    placementPosition.set(0, definition.groundOffset, 0);
    previewMesh.position.copy(placementPosition);
    scene.add(previewMesh);
    renderer.domElement.style.cursor = 'crosshair';
  } else {
    renderer.domElement.style.cursor = '';
    if (selectedObject && transformMode !== 'select') {
      transformControls.setMode(transformMode);
      transformControls.attach(selectedObject);
    }
  }
}

addButton.addEventListener('click', () => {
  const isOpen = addButton.getAttribute('aria-expanded') === 'true';
  addButton.setAttribute('aria-expanded', String(!isOpen));
  shapeMenu.hidden = isOpen;
});

shapeMenu.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((button) => {
  button.addEventListener('click', () => {
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
    transformMode = mode;
    document.querySelectorAll('.tool-button').forEach((tool) => {
      tool.classList.remove('active');
      tool.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    if (selectedObject) {
      if (mode === 'select') {
        transformControls.detach();
      } else {
        transformControls.setMode(mode);
        transformControls.attach(selectedObject);
      }
    }
  });
});

function updatePlacementPoint(event: PointerEvent) {
  if (!placementShape || !previewMesh) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.ray.intersectPlane(placementPlane, new THREE.Vector3());
  if (!hit) return;
  placementPosition.set(hit.x, shapeDefinitions[placementShape].groundOffset, hit.z);
  previewMesh.position.copy(placementPosition);
}

renderer.domElement.addEventListener('pointermove', updatePlacementPoint);
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!placementShape || event.button !== 0) return;
  updatePlacementPoint(event);
  const shape = placementShape;
  addObject(shape, placementPosition.clone().setY(0));
  setPlacementMode(null);
});

let selectionPointerStart: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (placementShape || event.button !== 0) {
    selectionPointerStart = null;
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
  const [hit] = raycaster.intersectObjects(objects, false);
  selectObject(hit?.object instanceof THREE.Mesh ? hit.object : null);
});

window.addEventListener('keydown', (event) => {
  if (!placementShape) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    addObject(placementShape, new THREE.Vector3(0, 0, 0));
    setPlacementMode(null);
  } else if (event.key === 'Escape') {
    setPlacementMode(null);
  }
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

function render() {
  controls.update();
  grid.position.x = camera.position.x;
  grid.position.z = camera.position.z;
  gridMaterial.uniforms.uCameraPosition.value.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();
