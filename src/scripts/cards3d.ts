// The interactive 3D cards in the product tiles.
// Loaded on demand by motion.ts (desktop only). Each card is a rounded slab built in
// code; its faces are the images in src/assets/card/. All four tiles share one WebGL
// renderer, which paints into a small canvas inside each tile, so the cards cost
// one graphics context between them and move and fade with their tiles.
import {
  AmbientLight,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three';

// Bank-card proportions (85.6 x 54 x 0.76 mm), with the height as one unit.
const CARD_W = 1.586;
const CARD_H = 1;
const CARD_D = 0.018;
const CORNER = 0.064;
const BEVEL = 0.004;

const TAU = Math.PI * 2;
const SPIN_SECONDS = 18; // the large card makes one slow turn, so its back comes round
const BASE_TILT = 0.122; // the same 7 degree lean as the drawn mockups
const CARD_SHARE = 0.6; // share of the tile's width a card fills, as in the mockups
const LIFT = 0.26; // how far a card rises towards the viewer on hover

// The three signal arcs, in card units, placed where the mockups draw them.
const ARC_CENTRE = { x: 0.4355, y: 0.0397 };
const ARC_RADII = [0.0832, 0.1595, 0.2358];
const ARC_HALF_WIDTH = 0.0187;
const ARC_HALF_ANGLE = (38 * Math.PI) / 180;

function roundedRect(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** A flat face cut to the card outline, with the image stretched edge to edge. */
function faceGeometry() {
  const geometry = new ShapeGeometry(roundedRect(CARD_W, CARD_H, CORNER), 24);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + CARD_W / 2) / CARD_W, (position.getY(i) + CARD_H / 2) / CARD_H);
  }
  return geometry;
}

/** One signal arc as a flat ribbon with round ends, drawn around the point the signal leaves from. */
function arcGeometry(radius: number) {
  const a = ARC_HALF_ANGLE;
  const h = ARC_HALF_WIDTH;
  const shape = new Shape();
  shape.absarc(0, 0, radius + h, -a, a, false);
  shape.absarc(radius * Math.cos(a), radius * Math.sin(a), h, a, a + Math.PI, false);
  shape.absarc(0, 0, radius - h, a, -a, true);
  shape.absarc(radius * Math.cos(a), -radius * Math.sin(a), h, Math.PI - a, TAU - a, false);
  return new ShapeGeometry(shape, 20);
}

interface Card {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  scene: Scene;
  camera: PerspectiveCamera;
  rig: Group;
  card: Group;
  arcs: Mesh[];
  turns: boolean;
  phase: number;
  visible: boolean;
  hovering: boolean;
  pointer: { x: number; y: number };
  eased: { x: number; y: number };
  spin: number;
  lift: number;
  pulse: number;
}

export async function mountCards(hosts: HTMLElement[]) {
  if (!hosts.length) return;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const ratio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(ratio);
  renderer.setClearAlpha(0);
  renderer.setScissorTest(true);
  const gl = renderer.domElement;

  // Colours come from the site's own variables.
  const css = getComputedStyle(document.documentElement);
  const cream = new Color(css.getPropertyValue('--color-cream').trim() || '#fbeed9');
  const red = new Color(css.getPropertyValue('--color-red').trim() || '#de1d2b');

  const loader = new TextureLoader();
  const load = async (url: string) => {
    const map = await loader.loadAsync(url);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return map;
  };

  // Shared shapes and materials.
  const outline = roundedRect(CARD_W - BEVEL * 2, CARD_H - BEVEL * 2, CORNER - BEVEL);
  const bodyGeometry = new ExtrudeGeometry(outline, {
    depth: CARD_D - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 24,
  });
  bodyGeometry.translate(0, 0, -(CARD_D - BEVEL * 2) / 2);
  const face = faceGeometry();
  const arcGeometries = ARC_RADII.map(arcGeometry);
  const finish = { roughness: 0.42, metalness: 0.05 };
  const bodyMaterial = new MeshStandardMaterial({ color: cream, roughness: 0.6 });
  const backMaterial = new MeshStandardMaterial({ map: await load(hosts[0].dataset.back ?? ''), ...finish });

  const cards: Card[] = [];
  for (const [index, host] of hosts.entries()) {
    if (!host.dataset.front) continue;

    const front = new Mesh(face, new MeshStandardMaterial({ map: await load(host.dataset.front), ...finish }));
    front.position.z = CARD_D / 2 + 0.0008;
    const back = new Mesh(face, backMaterial);
    back.rotation.y = Math.PI;
    back.position.z = -CARD_D / 2 - 0.0008;

    // Each arc gets its own material so it can pulse on its own.
    const arcs = arcGeometries.map((geometry) => {
      const arc = new Mesh(geometry, new MeshStandardMaterial({ color: red, transparent: true, ...finish }));
      arc.position.set(ARC_CENTRE.x, ARC_CENTRE.y, CARD_D / 2 + 0.0016);
      return arc;
    });

    const card = new Group().add(new Mesh(bodyGeometry, bodyMaterial), front, back, ...arcs);
    const rig = new Group().add(card);
    rig.rotation.z = BASE_TILT;

    const scene = new Scene();
    scene.add(rig);
    // Mostly even light, so the faces keep their true colours, plus one key light
    // for a soft sheen as the card turns.
    scene.add(new AmbientLight(0xffffff, 2.5));
    const key = new DirectionalLight(0xffffff, 0.8);
    key.position.set(-1.4, 1.8, 3);
    scene.add(key);

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) continue;
    host.append(canvas);

    cards.push({
      host,
      canvas,
      context,
      scene,
      camera: new PerspectiveCamera(28, 1, 0.1, 50),
      rig,
      card,
      arcs,
      turns: 'turn' in host.dataset,
      // Offsets the idle float, so no two cards move in step.
      phase: index * 1.9,
      visible: false,
      hovering: false,
      pointer: { x: 0, y: 0 },
      eased: { x: 0, y: 0 },
      spin: 0,
      lift: 0,
      pulse: Infinity,
    });
  }
  if (!cards.length) return;

  // The shared drawing buffer is as large as the largest tile; each card uses a corner of it.
  const fit = () => {
    let widest = 1;
    let tallest = 1;
    for (const item of cards) {
      const width = Math.round(item.host.clientWidth * ratio);
      const height = Math.round(item.host.clientHeight * ratio);
      if (!width || !height) continue;
      if (item.canvas.width !== width || item.canvas.height !== height) {
        item.canvas.width = width;
        item.canvas.height = height;
      }
      item.camera.aspect = width / height;
      const visibleWidth = CARD_W / CARD_SHARE;
      item.camera.position.z = visibleWidth / (2 * Math.tan((item.camera.fov * Math.PI) / 360) * item.camera.aspect);
      item.camera.updateProjectionMatrix();
      widest = Math.max(widest, width);
      tallest = Math.max(tallest, height);
    }
    renderer.setSize(widest / ratio, tallest / ratio, false);
  };
  fit();
  const resize = new ResizeObserver(fit);
  cards.forEach((item) => resize.observe(item.host));

  // --- Pointer -------------------------------------------------------------
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  window.addEventListener(
    'pointermove',
    (event) => {
      for (const item of cards) {
        if (!item.visible) continue;
        const box = item.host.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        if (item.turns) {
          // The large card leans towards the pointer from anywhere on the page.
          item.pointer.x = clamp(dx / (window.innerWidth / 2));
          item.pointer.y = clamp(dy / (window.innerHeight / 2));
        } else if (item.hovering) {
          item.pointer.x = clamp(dx / (box.width * 0.6));
          item.pointer.y = clamp(dy / (box.height * 0.9));
        }
      }
    },
    { passive: true },
  );
  const settle = (item: Card) => {
    item.hovering = false;
    if (!item.turns) item.pointer.x = item.pointer.y = 0;
  };
  for (const item of cards) {
    const tile = item.host.closest<HTMLElement>('.tile') ?? item.host;
    tile.addEventListener('pointerenter', () => {
      item.hovering = true;
      item.pulse = 0;
    });
    tile.addEventListener('pointerleave', () => settle(item));
  }
  // If the pointer leaves the page altogether, no card is left hanging mid-hover.
  document.documentElement.addEventListener('pointerleave', () => cards.forEach(settle));
  window.addEventListener('blur', () => cards.forEach(settle));

  // --- Drawing -------------------------------------------------------------
  let clock = 0;
  let last = 0;
  let frame = 0;

  // One pulse: each arc swells outwards and settles, the next following a beat later.
  const swell = (time: number) => {
    const t = time % 0.85;
    return time < 0 || time > 1.7 ? 0 : Math.sin(Math.min(1, t / 0.6) * Math.PI) ** 2;
  };

  const update = (item: Card, dt: number) => {
    const follow = 1 - Math.exp(-dt * 4.5);
    item.eased.x += (item.pointer.x - item.eased.x) * follow;
    item.eased.y += (item.pointer.y - item.eased.y) * follow;
    item.lift += ((item.hovering ? 1 : 0) - item.lift) * (1 - Math.exp(-dt * 5));

    const t = clock + item.phase;
    if (item.turns) {
      if (item.hovering) {
        // Under the pointer the card settles face-on, so the visitor can tilt it.
        const faceOn = Math.round(item.spin / TAU) * TAU;
        item.spin += (faceOn - item.spin) * (1 - Math.exp(-dt * 3.5));
      } else {
        item.spin += (dt * TAU) / SPIN_SECONDS;
      }
      item.card.rotation.y = item.spin + item.eased.x * 0.6;
    } else {
      // The smaller cards sway gently at rest and turn to the pointer on hover.
      item.card.rotation.y = Math.sin(t * 0.55) * 0.2 * (1 - item.lift) + item.eased.x * 0.55;
    }
    item.rig.rotation.x = 0.1 + item.eased.y * 0.42;
    item.rig.rotation.z = BASE_TILT + Math.sin(t * 0.7) * 0.014;
    item.rig.position.y = Math.sin(t * 0.9) * 0.035;
    item.rig.position.z = item.lift * LIFT;

    // The arcs pulse twice when the pointer arrives, and again every few seconds while it stays.
    if (item.pulse < 4) item.pulse += dt;
    if (item.hovering && item.pulse > 3.2) item.pulse = 0;
    item.arcs.forEach((arc, i) => {
      const amount = swell(item.pulse - i * 0.12);
      arc.scale.setScalar(1 + amount * 0.16);
      (arc.material as MeshStandardMaterial).opacity = 1 - amount * 0.35;
    });
  };

  const render = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    clock += dt;

    for (const item of cards) {
      if (!item.visible || !item.canvas.width) continue;
      update(item, dt);
      const { width, height } = item.canvas;
      renderer.setViewport(0, 0, width / ratio, height / ratio);
      renderer.setScissor(0, 0, width / ratio, height / ratio);
      renderer.render(item.scene, item.camera);
      // WebGL counts rows from the bottom, the 2D canvas from the top.
      item.context.clearRect(0, 0, width, height);
      item.context.drawImage(gl, 0, gl.height - height, width, height, 0, 0, width, height);
    }
    frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(render);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  // Draw only the cards that are on screen, and nothing at all when none are.
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const item = cards.find((candidate) => candidate.host === entry.target);
      if (item) item.visible = entry.isIntersecting;
    }
    if (cards.some((item) => item.visible)) start();
    else stop();
  });
  cards.forEach((item) => watcher.observe(item.host));

  // If the graphics context is lost, fall back to the drawn mockups.
  gl.addEventListener('webglcontextlost', () => {
    stop();
    cards.forEach((item) => item.host.classList.remove('is-3d'));
  });

  // One first frame for every card, then fade them in over the drawings.
  cards.forEach((item) => (item.visible = true));
  render(performance.now());
  cancelAnimationFrame(frame);
  frame = 0;
  cards.forEach((item) => (item.visible = false));
  requestAnimationFrame(() => cards.forEach((item) => item.host.classList.add('is-3d')));
}
