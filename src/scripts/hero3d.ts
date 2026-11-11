// The hero's phone and card as real 3D objects (Three.js), for desktops with a mouse.
// Loaded on demand by motion.ts once the hero is on screen and the page is idle.
//
// Units are the same as the CSS scene: 1 unit = 1% of the scene's width, with the
// origin at the centre of the stage. The phone's screen is the page's own HTML,
// placed on the 3D phone by CSS3DRenderer; the WebGL canvas above it has a
// screen-shaped hole, so the text stays sharp and the card can still pass in front.
import {
  AddEquation,
  CanvasTexture,
  Color,
  CustomBlending,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoBlending,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  ZeroFactor,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStory, screenStory, STORY } from './hero-story';

// The canvas reaches past the stage on every side, so nothing clips while it tilts.
const OVERSCAN = 24;
const VIEW_W = 100 + OVERSCAN * 2;
const VIEW_H = 88 + OVERSCAN * 2;
const FOV = 22;

// Sizes and places taken from the CSS scene (HeroScene.astro).
const PHONE = { w: 41, h: 84, d: 4.6, r: 7.6, bevel: 0.75, x: 22.5, y: 0 };
const SCREEN = { w: 36.9, h: 79.9, r: 5.6 };
const CARD = { w: 49, h: 30.8, d: 0.95, r: 3.6, bevel: 0.2 };
const DEG = Math.PI / 180;
const PHONE_YAW = -12 * DEG;
const PHONE_PITCH = -4 * DEG;

// Where the card waits, and where it ends up: tucked behind the phone's lower left edge.
const AWAY = { x: -30, y: -25.5, z: 16, rx: -0.3, ry: 0.36, rz: 24 * DEG };
const TAPPED = { x: -20.5, y: -17.4, z: -9.6, rx: -0.08, ry: -0.1, rz: 14 * DEG };

// The signal arcs between them, sized like the CSS ones.
const WAVES = { x: -9.2, y: 3.2, z: 4.5, turn: 22 * DEG, radii: [5.3, 10.1, 15], half: 1.19, angle: 38 * DEG };

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

/** A slab with rounded corners and a smooth, many-segment bevel on every edge. */
function slab(size: { w: number; h: number; d: number; r: number; bevel: number }) {
  const { w, h, d, r, bevel } = size;
  const geometry = new ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, r - bevel), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -(d - bevel * 2) / 2);
  return geometry;
}

function plate(width: number, height: number, radius: number) {
  const geometry = new ShapeGeometry(roundedRect(width, height, radius), 48);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
  }
  return geometry;
}

/** One signal arc as a flat ribbon with round ends. */
function arcRibbon(radius: number) {
  const a = WAVES.angle;
  const h = WAVES.half;
  const shape = new Shape();
  shape.absarc(0, 0, radius + h, -a, a, false);
  shape.absarc(radius * Math.cos(a), radius * Math.sin(a), h, a, a + Math.PI, false);
  shape.absarc(0, 0, radius - h, a, -a, true);
  shape.absarc(radius * Math.cos(a), -radius * Math.sin(a), h, Math.PI - a, Math.PI * 2 - a, false);
  return new ShapeGeometry(shape, 24);
}

/** The card's printed face: the site's cream, the NFC wordmark and the red arcs. */
async function cardFace(colours: { cream: string; navy: string; red: string }, family: string) {
  const width = 1024;
  const height = Math.round((width * CARD.h) / CARD.w);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const unit = width / CARD.w; // pixels per scene unit
  const fontSize = 8.4 * unit;
  try {
    await document.fonts.load(`800 ${fontSize}px ${family}`, 'NFC');
  } catch {
    /* draw with whatever is available */
  }

  ctx.fillStyle = colours.cream;
  ctx.fillRect(0, 0, width, height);

  ctx.font = `800 ${fontSize}px ${family}`;
  ctx.letterSpacing = `${-0.02 * fontSize}px`;
  ctx.textBaseline = 'alphabetic';
  const word = ctx.measureText('NFC');
  const arcsWidth = 6 * unit;
  const gap = 1.8 * unit;
  const left = (width - (word.width + gap + arcsWidth)) / 2;
  ctx.fillStyle = colours.navy;
  ctx.fillText('NFC', left, height / 2 + word.actualBoundingBoxAscent / 2);

  // The arcs, from the same numbers as the SVG (viewBox 34 x 50, drawn 6 units wide).
  const k = arcsWidth / 34;
  const cx = left + word.width + gap - 5 * k;
  ctx.strokeStyle = colours.red;
  ctx.lineWidth = 5.4 * k;
  ctx.lineCap = 'round';
  for (const radius of [12, 23, 34]) {
    ctx.beginPath();
    ctx.arc(cx, height / 2, radius * k, -38 * DEG, 38 * DEG);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A slanted band of faint light on black, for the sheen on the phone's glass. */
function glassSheen() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 4);
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0.34, 'rgb(255 255 255 / 0)');
    gradient.addColorStop(0.5, 'rgb(255 255 255 / 0.11)');
    gradient.addColorStop(0.66, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 4);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.center.set(0.5, 0.5);
  texture.rotation = -0.42;
  return texture;
}

function softShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(1, 0.25);
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgb(0 0 0 / 0.9)');
    gradient.addColorStop(0.55, 'rgb(0 0 0 / 0.35)');
    gradient.addColorStop(1, 'rgb(0 0 0 / 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new CanvasTexture(canvas);
}

/**
 * Builds the scene and starts the story loop. Resolves to false, leaving the page
 * untouched, if the graphics context cannot be created.
 */
export async function mountHero(sceneEl: HTMLElement, onLost: () => void) {
  const stage = sceneEl.querySelector<HTMLElement>('[data-s-stage]');
  const screenEl = sceneEl.querySelector<HTMLElement>('[data-s-screen]');
  const faceEl = sceneEl.querySelector<HTMLElement>('[data-s-face]');
  const wordEl = sceneEl.querySelector<HTMLElement>('.s-card-word');
  if (!stage || !screenEl || !faceEl) return false;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  const canvas = renderer.domElement;
  canvas.className = 's-gl';
  canvas.setAttribute('aria-hidden', 'true');

  // Colours come from the site's own variables.
  const css = getComputedStyle(document.documentElement);
  const colour = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const colours = {
    cream: colour('--color-cream', '#fbeed9'),
    navy: colour('--color-navy', '#04072d'),
    navy2: colour('--color-navy-2', '#0a0e3d'),
    red: colour('--color-red', '#de1d2b'),
  };

  const scene = new Scene();
  // A soft studio environment, generated in code, for reflections on glass and frame.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // Light levels are set so the card's cream and the phone's navy come out as the site's own.
  scene.environmentIntensity = 0.48;
  pmrem.dispose();

  const key = new DirectionalLight(0xffffff, 0.6);
  key.position.set(-70, 110, 170);
  // Rim light from behind, so the edges stand clear of the dark background.
  const rim = new DirectionalLight(0xffffff, 2.4);
  rim.position.set(120, 70, -140);
  scene.add(key, rim);

  const camera = new PerspectiveCamera(FOV, VIEW_W / VIEW_H, 10, 2000);
  camera.position.z = VIEW_H / 2 / Math.tan((FOV * DEG) / 2);

  const root = new Group();
  scene.add(root);

  // --- Phone ---------------------------------------------------------------
  const phone = new Group();
  const phoneFrame = new Mesh(
    slab(PHONE),
    new MeshPhysicalMaterial({
      color: new Color(colours.cream),
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
    }),
  );
  const glass = plate(PHONE.w - 1.5, PHONE.h - 1.5, PHONE.r - 0.75);
  const frontGlass = new Mesh(
    glass,
    new MeshPhysicalMaterial({
      color: new Color(colours.navy2),
      roughness: 0.16,
      clearcoat: 0.35,
      clearcoatRoughness: 0.1,
      // Dark glass mirrors the whole room; held back so the navy stays navy.
      envMapIntensity: 0.1,
    }),
  );
  frontGlass.position.z = PHONE.d / 2 + 0.02;
  const backGlass = new Mesh(
    glass,
    new MeshPhysicalMaterial({
      color: new Color(colours.navy2),
      roughness: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.3,
    }),
  );
  backGlass.rotation.y = Math.PI;
  backGlass.position.z = -PHONE.d / 2 - 0.02;

  // A screen-shaped hole in the canvas: the HTML screen shows through it.
  const screenShape = plate(SCREEN.w, SCREEN.h, SCREEN.r);
  const hole = new Mesh(
    screenShape,
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: NoBlending }),
  );
  hole.position.z = PHONE.d / 2 + 0.04;
  hole.renderOrder = 1;
  // A soft band of light that glides across the glass as the phone turns. It only
  // ever adds light, and it rests off to one side, so a still screen keeps its exact colours.
  const sheenMap = glassSheen();
  const gloss = new Mesh(
    screenShape,
    new MeshBasicMaterial({
      map: sheenMap,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    }),
  );
  gloss.position.z = PHONE.d / 2 + 0.06;
  gloss.renderOrder = 2;

  screenEl.classList.add('is-gl');
  const screen = new CSS3DObject(screenEl);
  screen.position.z = PHONE.d / 2 + 0.04;

  phone.add(phoneFrame, frontGlass, backGlass, hole, gloss, screen);
  phone.position.set(PHONE.x, PHONE.y, 0);
  root.add(phone);

  // --- Card ----------------------------------------------------------------
  const card = new Group();
  const cardBody = new Mesh(
    slab(CARD),
    new MeshPhysicalMaterial({ color: new Color(colours.cream), roughness: 0.84 }),
  );
  card.add(cardBody);
  const family = wordEl ? getComputedStyle(wordEl).fontFamily : 'sans-serif';
  const faceMap = await cardFace(colours, family);
  if (faceMap) {
    faceMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const face = new Mesh(
      plate(CARD.w - 0.4, CARD.h - 0.4, CARD.r - 0.2),
      new MeshStandardMaterial({ map: faceMap, roughness: 0.86 }),
    );
    face.position.z = CARD.d / 2 + 0.02;
    card.add(face);
  }
  root.add(card);

  // --- Signal arcs ---------------------------------------------------------
  const waves = new Group();
  const arcs = WAVES.radii.map((radius) => {
    const arc = new Mesh(
      arcRibbon(radius),
      new MeshBasicMaterial({ color: new Color(colours.red), transparent: true, opacity: 0, depthWrite: false }),
    );
    arc.renderOrder = 3;
    return arc;
  });
  waves.add(...arcs);
  waves.position.set(WAVES.x, WAVES.y, WAVES.z);
  waves.rotation.z = WAVES.turn;
  root.add(waves);

  // --- Contact shadow ------------------------------------------------------
  const shadow = new Mesh(
    new PlaneGeometry(92, 14),
    new MeshBasicMaterial({ map: softShadow(), transparent: true, opacity: 0.55, depthWrite: false }),
  );
  shadow.position.set(3, -47.5, -14);
  shadow.renderOrder = -1;
  root.add(shadow);

  // --- HTML screen layer ---------------------------------------------------
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.classList.add('s-gl-screen');
  stage.append(cssRenderer.domElement, canvas);

  const fit = () => {
    const unit = stage.clientWidth / 100; // pixels per scene unit
    if (!unit) return;
    renderer.setSize(VIEW_W * unit, VIEW_H * unit, false);
    cssRenderer.setSize(VIEW_W * unit, VIEW_H * unit);
    screen.scale.setScalar(1 / unit);
  };
  fit();
  new ResizeObserver(fit).observe(stage);

  // --- Story ---------------------------------------------------------------
  const state = { tap: 0, nudge: 0 };
  const pulse = arcs.map(() => ({ opacity: 0, scale: 0.72 }));

  const story = createStory();
  story
    .fromTo(state, { tap: 0 }, { tap: 1, duration: STORY.glideTime, ease: 'power3.inOut' }, STORY.glide)
    // the tap: the phone gives a little and settles
    .to(state, { nudge: 1, duration: 0.16, ease: 'power2.out' }, STORY.tap - 0.04)
    .to(state, { nudge: 0, duration: 0.9, ease: 'power2.out' }, STORY.tap + 0.12);
  STORY.pulses.forEach((at) => {
    story
      .fromTo(pulse, { opacity: 0, scale: 0.72 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.13, immediateRender: false }, at)
      .to(pulse, { opacity: 0, duration: 0.5, stagger: 0.13, ease: 'power1.inOut' }, at + 0.68);
  });
  screenStory(story, sceneEl);
  story.to(state, { tap: 0, duration: STORY.leaveTime, ease: 'power2.inOut' }, STORY.leave);

  // --- Pointer tilt --------------------------------------------------------
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const hero = sceneEl.closest('section') ?? sceneEl;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  hero.addEventListener(
    'pointermove',
    (event) => {
      const box = stage.getBoundingClientRect();
      pointer.x = clamp(((event as PointerEvent).clientX - (box.left + box.width / 2)) / (window.innerWidth / 2));
      pointer.y = clamp(((event as PointerEvent).clientY - (box.top + box.height / 2)) / (window.innerHeight / 2));
    },
    { passive: true },
  );
  const centre = () => (pointer.x = pointer.y = 0);
  hero.addEventListener('pointerleave', centre);
  document.documentElement.addEventListener('pointerleave', centre);
  window.addEventListener('blur', centre);

  // --- Drawing -------------------------------------------------------------
  const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
  let clock = 0;
  let last = 0;
  let frame = 0;

  const render = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    clock += dt;
    if (import.meta.env.DEV && '__nfcityHold' in window) clock = 0;

    // The whole scene leans towards the pointer, up to about ten degrees.
    const follow = 1 - Math.exp(-dt * 3.2);
    eased.x += (pointer.x - eased.x) * follow;
    eased.y += (pointer.y - eased.y) * follow;
    root.rotation.y = eased.x * 10 * DEG;
    root.rotation.x = eased.y * 7 * DEG;

    // Idle float: slow, and out of step between the two.
    phone.position.y = PHONE.y + Math.sin(clock * 0.84) * 1.1;
    phone.position.z = -state.nudge * 0.9;
    phone.rotation.set(
      PHONE_PITCH + Math.sin(clock * 0.52) * 0.022,
      PHONE_YAW - state.nudge * 0.028 + Math.sin(clock * 0.4 + 1.3) * 0.02,
      Math.sin(clock * 0.66 + 0.6) * 0.011,
    );

    const t = state.tap;
    const calm = 1 - t * 0.55; // the card holds steadier while it is against the phone
    card.position.set(
      mix(AWAY.x, TAPPED.x, t),
      mix(AWAY.y, TAPPED.y, t) + Math.sin(clock * 1.02 + 2.2) * 1.5 * calm,
      mix(AWAY.z, TAPPED.z, t) - state.nudge * 0.9,
    );
    card.rotation.set(
      mix(AWAY.rx, TAPPED.rx, t) + Math.sin(clock * 0.7 + 0.9) * 0.03 * calm,
      mix(AWAY.ry, TAPPED.ry, t) + Math.sin(clock * 0.58 + 2.8) * 0.04 * calm,
      mix(AWAY.rz, TAPPED.rz, t) + Math.sin(clock * 0.8 + 1.7) * 0.014 * calm,
    );

    // The sheen sits off the glass at rest and crosses it as the phone turns.
    const turn = (phone.rotation.y - PHONE_YAW + root.rotation.y) / (10 * DEG);
    sheenMap.offset.x = 0.9 - Math.abs(turn) * 1.05;

    arcs.forEach((arc, i) => {
      (arc.material as MeshBasicMaterial).opacity = pulse[i].opacity;
      arc.scale.setScalar(pulse[i].scale);
    });

    // The shadow softens a touch as the phone rises.
    const height = (phone.position.y - PHONE.y) / 1.1;
    (shadow.material as MeshBasicMaterial).opacity = 0.52 - height * 0.07;
    shadow.scale.setScalar(1 + height * 0.03);

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };

  const start = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(render);
    story.play();
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    story.pause();
  };

  // Run only while the hero is on screen.
  const trigger = ScrollTrigger.create({
    trigger: sceneEl,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? start() : stop()),
  });

  // If the graphics context is lost, hand the screen back to the CSS scene.
  canvas.addEventListener('webglcontextlost', () => {
    stop();
    trigger.kill();
    story.kill();
    screenEl.classList.remove('is-gl');
    screenEl.removeAttribute('style');
    faceEl.append(screenEl);
    canvas.remove();
    cssRenderer.domElement.remove();
    stage.classList.remove('is-gl');
    onLost();
  });

  if (import.meta.env.DEV) Object.assign(window, { __nfcityScene: story, __nfcityHero: { scene, gloss, hole, key, rim, card, phone } });

  // One frame first, then fade the canvas in over the CSS scene.
  render(performance.now());
  cancelAnimationFrame(frame);
  frame = 0;
  requestAnimationFrame(() => {
    stage.classList.add('is-gl');
    if (trigger.isActive) start();
  });
  return true;
}
