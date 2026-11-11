// All page motion lives here: smooth scrolling, scroll reveals, the hero scene,
// the FAQ, pointer tilt and the lazy 3D card.
// Everything animates transform and opacity only, on one shared easing curve.
// Nothing runs when the visitor prefers reduced motion; the page then shows its final state.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStory, screenStory, SOFT, STORY } from './hero-story';

declare global {
  interface Window {
    __nfcityMotion?: boolean;
  }
}

if (document.documentElement.classList.contains('motion')) {
  window.__nfcityMotion = true;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: SOFT });

  smoothScroll();
  reveals();
  heroScene();
  faq();

  // Pointer effects only where there is a real mouse or trackpad.
  if (finePointer()) {
    liftTiles();
    cards3d();
  }
}

function finePointer() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
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
        // Long enough that neighbours, such as the three product tiles, arrive one after another.
        stagger: 0.12,
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

/**
 * The hero: a card taps the phone, the arcs pulse, the review page opens, five stars fill.
 * Phones and tablets run it on the CSS 3D scene. Desktops with a mouse swap in the
 * Three.js scene (fetched once the hero is on screen and the page is idle) and fall
 * back to the CSS scene if that cannot start.
 */
function heroScene() {
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  if (!scene) return;

  const root = document.documentElement;
  // The CSS scene, for phones and as the fallback. It was held out of sight on
  // desktops while the 3D scene loaded, so it is let back in here.
  const runCss = () => {
    root.classList.remove('gl-first');
    cssHero(scene);
  };
  if (!finePointer() || !canRun3d()) {
    runCss();
    return;
  }

  // If the 3D scene is slow to arrive, show the still CSS scene in the meantime.
  const patience = window.setTimeout(() => root.classList.remove('gl-first'), 2500);
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    whenIdle(() =>
      import('./hero3d')
        .then(({ mountHero }) => mountHero(scene, runCss))
        .then((started) => {
          window.clearTimeout(patience);
          if (!started) runCss();
        })
        .catch(() => {
          window.clearTimeout(patience);
          runCss();
        }),
    );
  });
  observer.observe(scene);
}

/** Runs a task once the page has finished loading and the browser has a quiet moment. */
function whenIdle(task: () => void) {
  const run = () =>
    'requestIdleCallback' in window ? window.requestIdleCallback(task, { timeout: 1500 }) : setTimeout(task, 200);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/** The story loop on the CSS 3D scene, plus a pointer tilt where there is a mouse. */
function cssHero(scene: HTMLElement) {
  const card = scene.querySelector<HTMLElement>('[data-s-card]');
  const phone = scene.querySelector<HTMLElement>('[data-s-phone]');
  const world = scene.querySelector<HTMLElement>('[data-s-world]');
  const arcs = scene.querySelectorAll('[data-s-arc]');
  if (!card || !phone) return;

  // Depth is given in the scene's own units (1% of its width), so it scales with the scene.
  const depth = (units: number) => () => (scene.clientWidth / 100) * units;
  // Keep these two poses in step with the card's transforms in HeroScene.astro.
  const away = { xPercent: -20, yPercent: 26, z: depth(5), rotation: -24, rotationY: -18, rotationX: 14 };
  const tapped = { xPercent: 0, yPercent: 0, z: depth(-11), rotation: -14, rotationY: -6, rotationX: 5 };

  gsap.set(arcs, { transformOrigin: '0% 50%' });
  gsap.set(card, { x: 0, y: 0, ...away });
  gsap.set(phone, { rotationY: -12, rotationX: 4 });

  const story = createStory();
  story
    .fromTo(card, away, { ...tapped, duration: STORY.glideTime, ease: 'power3.inOut' }, STORY.glide)
    // the tap: the phone gives a little and settles
    .to(phone, { rotationY: -13.4, duration: 0.16, ease: 'power2.out' }, STORY.tap - 0.04)
    .to(phone, { rotationY: -12, duration: 0.9, ease: 'power2.out' }, STORY.tap + 0.12);
  STORY.pulses.forEach((at) => {
    story
      .fromTo(arcs, { opacity: 0, scale: 0.72 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.13, immediateRender: false }, at)
      .to(arcs, { opacity: 0, duration: 0.5, stagger: 0.13, ease: 'power1.inOut' }, at + 0.68);
  });
  screenStory(story, scene);
  story.to(card, { ...away, duration: STORY.leaveTime, ease: 'power2.inOut' }, STORY.leave);

  // Handy while tuning the timing in `npm run dev`; stripped from the real build.
  if (import.meta.env.DEV) Object.assign(window, { __nfcityScene: story });

  // Only run while the scene is on screen.
  const trigger = ScrollTrigger.create({
    trigger: scene,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? story.play() : story.pause()),
  });
  if (trigger.isActive) story.play();

  // With a mouse, the whole scene leans towards the pointer, up to about ten degrees.
  const hero = scene.closest('section');
  if (!world || !hero || !finePointer()) return;
  const glide = { duration: 1.1, ease: SOFT };
  const rotX = gsap.quickTo(world, 'rotationX', glide);
  const rotY = gsap.quickTo(world, 'rotationY', glide);
  const clamp = gsap.utils.clamp(-1, 1);
  const centre = () => {
    rotX(0);
    rotY(0);
  };
  hero.addEventListener('pointermove', (event) => {
    const box = scene.getBoundingClientRect();
    rotY(clamp((event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)) * 10);
    rotX(clamp((event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)) * -7);
  });
  hero.addEventListener('pointerleave', centre);
  document.documentElement.addEventListener('pointerleave', centre);
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
 * The large Google review tile rises a little under the pointer.
 * The three smaller tiles stay put, so they always line up; their cards do the moving.
 */
function liftTiles() {
  const tiles = gsap.utils.toArray<HTMLElement>('[data-tile="lift"]').flatMap((tile) => {
    const card = tile.firstElementChild as HTMLElement | null;
    if (!card) return [];
    const lift = gsap.quickTo(card, 'y', { duration: 0.8, ease: SOFT });
    const rest = () => {
      tile.classList.remove('is-hover');
      lift(0);
    };
    tile.addEventListener('pointerenter', () => {
      tile.classList.add('is-hover');
      lift(-5);
    });
    tile.addEventListener('pointerleave', rest);
    return [rest];
  });
  // If the pointer leaves the page altogether, nothing is left hanging mid-hover.
  const restAll = () => tiles.forEach((rest) => rest());
  document.documentElement.addEventListener('pointerleave', restAll);
  window.addEventListener('blur', restAll);
}

/**
 * The interactive 3D cards in the product tiles. Three.js is a large library, so it
 * is fetched only on capable desktops, and only when the tiles are about to scroll
 * into view. Phones, low-power devices and reduced-motion visitors keep the drawn cards.
 */
function cards3d() {
  const hosts = gsap.utils.toArray<HTMLElement>('[data-card3d]');
  if (!hosts.length || !canRun3d()) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      import('./cards3d')
        .then(({ mountCards }) => mountCards(hosts))
        .catch(() => {
          /* keep the drawn mockups */
        });
    },
    { rootMargin: '500px 0px' },
  );
  hosts.forEach((host) => observer.observe(host));
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
