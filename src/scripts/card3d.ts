// The interactive 3D NFC card in the Google review tile.
// Loaded on demand by motion.ts (desktop only). The card is a rounded box built in
// code; its faces are src/assets/card/front.webp and back.webp.
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

const TAU = Math.PI * 2;
const SPIN_SECONDS = 18; // one slow turn, so the back comes round now and then
const BASE_TILT = 0.122; // the same 7 degree lean as the drawn mockup
const CARD_SHARE = 0.6; // share of the tile's width the card fills, as in the mockup

function cardOutline() {
  const x = -CARD_W / 2;
  const y = -CARD_H / 2;
  const r = CORNER;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + CARD_W - r, y);
  shape.absarc(x + CARD_W - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + CARD_W, y + CARD_H - r);
  shape.absarc(x + CARD_W - r, y + CARD_H - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + CARD_H);
  shape.absarc(x + r, y + CARD_H - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** A flat face cut to the card outline, with the texture stretched edge to edge. */
function faceGeometry(shape: Shape) {
  const geometry = new ShapeGeometry(shape, 24);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + CARD_W / 2) / CARD_W, (position.getY(i) + CARD_H / 2) / CARD_H);
  }
  return geometry;
}

export async function mountCard(host: HTMLElement) {
  const { front: frontUrl, back: backUrl } = host.dataset;
  if (!frontUrl || !backUrl) return;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');

  const loader = new TextureLoader();
  const [frontMap, backMap] = await Promise.all([loader.loadAsync(frontUrl), loader.loadAsync(backUrl)]);
  for (const map of [frontMap, backMap]) {
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  // The card's edge takes the site's own cream.
  const cream = getComputedStyle(document.documentElement).getPropertyValue('--color-cream').trim();

  const shape = cardOutline();
  const body = new Mesh(
    new ExtrudeGeometry(shape, { depth: CARD_D, bevelEnabled: false, curveSegments: 24 }),
    new MeshStandardMaterial({ color: new Color(cream || '#fbeed9'), roughness: 0.6 }),
  );
  body.position.z = -CARD_D / 2;

  const face = faceGeometry(shape);
  const finish = { roughness: 0.42, metalness: 0.05 };
  const front = new Mesh(face, new MeshStandardMaterial({ map: frontMap, ...finish }));
  front.position.z = CARD_D / 2 + 0.0008;
  const back = new Mesh(face, new MeshStandardMaterial({ map: backMap, ...finish }));
  back.rotation.y = Math.PI;
  back.position.z = -CARD_D / 2 - 0.0008;

  const card = new Group().add(body, front, back);
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

  const camera = new PerspectiveCamera(28, 1, 0.1, 50);

  const fit = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const visibleWidth = CARD_W / CARD_SHARE;
    camera.position.z = visibleWidth / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    camera.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(host);

  // Pointer position relative to the card, from -1 to 1.
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let hovering = false;
  const tile = host.closest<HTMLElement>('[data-tilt]') ?? host;

  window.addEventListener(
    'pointermove',
    (event) => {
      const box = host.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)));
    },
    { passive: true },
  );
  tile.addEventListener('pointerenter', () => (hovering = true));
  tile.addEventListener('pointerleave', () => (hovering = false));

  let spin = 0;
  let clock = 0;
  let last = 0;
  let frame = 0;

  const render = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    clock += dt;

    if (hovering) {
      // Under the pointer the card settles face-on, so the visitor can tilt it.
      const faceOn = Math.round(spin / TAU) * TAU;
      spin += (faceOn - spin) * (1 - Math.exp(-dt * 3.5));
    } else {
      spin += (dt * TAU) / SPIN_SECONDS;
    }

    const follow = 1 - Math.exp(-dt * 4.5);
    eased.x += (pointer.x - eased.x) * follow;
    eased.y += (pointer.y - eased.y) * follow;

    card.rotation.y = spin + eased.x * 0.6;
    rig.rotation.x = 0.1 + eased.y * 0.42;
    rig.position.y = Math.sin(clock * 0.9) * 0.035;

    renderer.render(scene, camera);
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

  // Draw only while the tile is on screen.
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(host);

  canvas.addEventListener('webglcontextlost', () => {
    stop();
    host.classList.remove('is-3d');
  });

  host.append(canvas);
  renderer.render(scene, camera);
  requestAnimationFrame(() => host.classList.add('is-3d'));
}
