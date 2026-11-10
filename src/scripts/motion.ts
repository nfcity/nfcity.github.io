// All page motion lives here: smooth scrolling, scroll reveals, the hero scene,
// the FAQ, pointer tilt and the lazy 3D card.
// Everything animates transform and opacity only, on one shared easing curve.
// Nothing runs when the visitor prefers reduced motion; the page then shows its final state.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

declare global {
  interface Window {
    __nfcityMotion?: boolean;
  }
}

/** GSAP's name for the curve behind --ease-soft in global.css: cubic-bezier(0.22, 1, 0.36, 1). */
const SOFT = 'power4.out';

if (document.documentElement.classList.contains('motion')) {
  window.__nfcityMotion = true;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: SOFT });

  smoothScroll();
  reveals();
  heroScene();
  faq();

  // Pointer effects only where there is a real mouse or trackpad.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tiltTiles();
    heroTilt();
    card3d();
  }
}

/** Lenis smooths wheel and trackpad scrolling; touch scrolling stays native. */
function smoothScroll() {
  const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/**
 * Fade and a slight rise as blocks scroll into view.
 * data-reveal="children" staggers a block's children (label, heading, text);
 * divider lines (.rule-t / .rule-b) draw in from the left through CSS once marked .is-in.
 */
function reveals() {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (blocks) => {
      const targets = (blocks as HTMLElement[]).flatMap((block) =>
        block.dataset.reveal === 'children' ? (Array.from(block.children) as HTMLElement[]) : [block],
      );
      // Marking the block first lifts the CSS hiding, so each element animates from
      // hidden to its own natural state (labels, for one, rest at partial opacity).
      blocks.forEach((block) => block.classList.add('is-in'));
      gsap.from(targets, {
        opacity: 0,
        y: 24,
        duration: 1,
        stagger: 0.08,
        overwrite: true,
        // Hand the elements back clean, so hover and FAQ motion start from nothing.
        clearProps: 'opacity,transform',
      });
    },
  });

  ScrollTrigger.batch('.rule-t:not([data-reveal]), .rule-b:not([data-reveal])', {
    start: 'top 92%',
    once: true,
    onEnter: (lines) =>
      lines.forEach((line, i) => gsap.delayedCall(i * 0.08, () => line.classList.add('is-in'))),
  });
}

/** Card reaches the phone, arcs pulse, the review page opens and five stars fill. */
function heroScene() {
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  if (!scene) return;

  const card = scene.querySelector('[data-s-card]');
  const arcs = scene.querySelectorAll('[data-s-arc]');
  const review = scene.querySelector('[data-s-review]');
  const stars = scene.querySelectorAll('[data-s-star]');
  if (!card || !review) return;

  // Text layers move with transform only, never opacity, so they stay fully legible.
  // Keep `away` in step with the starting frame in HeroScene.astro.
  const away = { xPercent: -20, yPercent: 26, rotation: -24 };
  const pulseIn = { opacity: 1, scale: 1, duration: 0.5, stagger: 0.13 };

  gsap.set(arcs, { transformOrigin: '0% 50%' });
  gsap.set(stars, { transformOrigin: '50% 50%' });
  // Take over from the CSS starting frame, in percentages so it scales with the scene.
  gsap.set(card, { x: 0, y: 0, ...away });
  gsap.set(review, { y: 0, yPercent: 101 });

  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.9 });

  tl.fromTo(card, away, { xPercent: 0, yPercent: 0, rotation: -14, duration: 1.4, ease: 'power2.inOut' }, 0.3)
    // two calm pulses
    .fromTo(arcs, { opacity: 0, scale: 0.72 }, pulseIn, 1.4)
    .to(arcs, { opacity: 0, duration: 0.5, stagger: 0.13, ease: 'power1.inOut' }, 2.1)
    .fromTo(arcs, { opacity: 0, scale: 0.72 }, { ...pulseIn, immediateRender: false }, 2.75)
    .to(arcs, { opacity: 0, duration: 0.55, stagger: 0.13, ease: 'power1.inOut' }, 3.55)
    // the review page slides up and the stars fill one by one
    .fromTo(review, { yPercent: 101 }, { yPercent: 0, duration: 0.95 }, 2.85)
    .fromTo(stars, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.17 }, 3.6)
    // hold on the result, then reset quietly
    .to(review, { yPercent: 101, duration: 0.85, ease: 'power2.inOut' }, '+=2.8')
    .to(card, { ...away, duration: 1.3, ease: 'power2.inOut' }, '<');

  // Handy while tuning the timing in `npm run dev`; stripped from the real build.
  if (import.meta.env.DEV) Object.assign(window, { __nfcityScene: tl });

  // Only run while the scene is on screen.
  const trigger = ScrollTrigger.create({
    trigger: scene,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
  });
  if (trigger.isActive) tl.play();
}

/**
 * FAQ rows glide open and closed. The answer only fades; everything below it is
 * moved with transforms (FLIP) from where it was to where it now sits, so no
 * height is ever animated.
 */
function faq() {
  const section = document.querySelector('#faq');
  const items = gsap.utils.toArray<HTMLDetailsElement>('.faq-item');
  const below = gsap.utils.toArray<HTMLElement>('#contact, footer');
  if (!section || !items.length) return;

  // GSAP's Flip plugin is only needed here, so it is fetched as the section approaches.
  let flip: Promise<typeof import('gsap/Flip')> | undefined;
  const loadFlip = () =>
    (flip ??= import('gsap/Flip').then((module) => {
      gsap.registerPlugin(module.Flip);
      return module;
    }));
  const nearby = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      nearby.disconnect();
      loadFlip();
    },
    { rootMargin: '800px 0px' },
  );
  nearby.observe(section);

  items.forEach((item, index) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector<HTMLElement>('.faq-a');
    if (!summary || !answer) return;
    let busy = false;

    let Flip: (typeof import('gsap/Flip'))['Flip'];
    const glide = (change: () => void) => {
      const moving = [...items.slice(index + 1), ...below];
      const state = Flip.getState(moving);
      change();
      Flip.from(state, {
        duration: 0.65,
        ease: SOFT,
        onComplete: () => {
          busy = false;
          ScrollTrigger.refresh();
        },
      });
    };

    summary.addEventListener('click', async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      try {
        ({ Flip } = await loadFlip());
      } catch {
        // Could not fetch the plugin: open or close the plain way.
        item.open = !item.open;
        busy = false;
        return;
      }

      if (!item.open) {
        glide(() => (item.open = true));
        gsap.fromTo(
          answer,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.6, delay: 0.12, clearProps: 'opacity,transform' },
        );
      } else {
        item.classList.add('is-closing');
        gsap.to(answer, {
          opacity: 0,
          y: -6,
          duration: 0.22,
          ease: 'power1.in',
          onComplete: () => {
            glide(() => (item.open = false));
            item.classList.remove('is-closing');
            gsap.set(answer, { clearProps: 'opacity,transform' });
          },
        });
      }
    });
  });
}

/**
 * Product tiles lift towards the pointer; the three smaller ones also tilt,
 * and the card drawing inside slides a little the other way for depth.
 */
function tiltTiles() {
  gsap.utils.toArray<HTMLElement>('[data-tilt]').forEach((tile) => {
    const card = tile.firstElementChild as HTMLElement | null;
    if (!card) return;
    const tilts = tile.dataset.tilt === 'tilt';
    const art = tilts ? tile.querySelector<HTMLElement>('[data-tilt-art]') : null;
    const glide = { duration: 0.8, ease: SOFT };

    gsap.set(card, { transformPerspective: 900 });
    const lift = gsap.quickTo(card, 'y', glide);
    const rotX = gsap.quickTo(card, 'rotationX', glide);
    const rotY = gsap.quickTo(card, 'rotationY', glide);
    const artX = art && gsap.quickTo(art, 'x', glide);
    const artY = art && gsap.quickTo(art, 'y', glide);

    tile.addEventListener('pointermove', (event) => {
      const box = tile.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      tile.classList.add('is-hover');
      lift(tilts ? -8 : -5);
      if (!tilts) return;
      rotY(x * 7);
      rotX(y * -6);
      artX?.(x * -12);
      artY?.(y * -9);
    });
    tile.addEventListener('pointerleave', () => {
      tile.classList.remove('is-hover');
      lift(0);
      rotX(0);
      rotY(0);
      artX?.(0);
      artY?.(0);
    });
  });
}

/** The hero scene leans a few degrees towards the pointer, with the phone drifting slightly for depth. */
function heroTilt() {
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  const stage = scene?.querySelector<HTMLElement>('[data-s-stage]');
  const phone = scene?.querySelector<HTMLElement>('[data-s-phone]');
  const hero = scene?.closest('section');
  if (!scene || !stage || !phone || !hero) return;

  const glide = { duration: 1.1, ease: SOFT };
  gsap.set(stage, { transformPerspective: 1100 });
  const rotX = gsap.quickTo(stage, 'rotationX', glide);
  const rotY = gsap.quickTo(stage, 'rotationY', glide);
  const phoneX = gsap.quickTo(phone, 'x', glide);
  const phoneY = gsap.quickTo(phone, 'y', glide);
  const clamp = gsap.utils.clamp(-1, 1);

  hero.addEventListener('pointermove', (event) => {
    const box = scene.getBoundingClientRect();
    const x = clamp((event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2));
    const y = clamp((event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2));
    rotY(x * 6);
    rotX(y * -5);
    phoneX(x * 6);
    phoneY(y * 5);
  });
  hero.addEventListener('pointerleave', () => {
    rotX(0);
    rotY(0);
    phoneX(0);
    phoneY(0);
  });
}

/**
 * The interactive 3D card. Three.js is a large library, so it is fetched only on
 * capable desktops, and only when the card's tile is about to scroll into view.
 * Phones, low-power devices and reduced-motion visitors keep the drawn mockup.
 */
function card3d() {
  const host = document.querySelector<HTMLElement>('[data-card3d]');
  if (!host || !canRun3d()) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      import('./card3d')
        .then(({ mountCard }) => mountCard(host))
        .catch(() => {
          /* keep the drawn mockup */
        });
    },
    { rootMargin: '500px 0px' },
  );
  observer.observe(host);
}

function canRun3d() {
  const wide = window.matchMedia('(min-width: 64rem)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!wide || cores < 4 || saveData) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
