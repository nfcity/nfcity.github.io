// All page motion lives here: smooth scrolling, scroll reveals and the hero scene.
// Nothing runs when the visitor prefers reduced motion; the page then shows its final state.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

declare global {
  interface Window {
    __nfcityMotion?: boolean;
  }
}

if (document.documentElement.classList.contains('motion')) {
  window.__nfcityMotion = true;
  gsap.registerPlugin(ScrollTrigger);

  smoothScroll();
  reveals();
  heroScene();
}

/** Lenis smooths wheel and trackpad scrolling; touch scrolling stays native. */
function smoothScroll() {
  const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/** Gentle fade-and-rise as blocks scroll into view. */
function reveals() {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (elements) =>
      gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.09,
        overwrite: true,
        onComplete: () => gsap.set(elements, { willChange: 'auto' }),
      }),
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
  const pulseIn = { opacity: 1, scale: 1, duration: 0.42, stagger: 0.13 };

  gsap.set(arcs, { transformOrigin: '0% 50%' });
  gsap.set(stars, { transformOrigin: '50% 50%' });
  // Take over from the CSS starting frame, in percentages so it scales with the scene.
  gsap.set(card, { x: 0, y: 0, ...away });
  gsap.set(review, { y: 0, yPercent: 101 });

  const tl = gsap.timeline({
    paused: true,
    repeat: -1,
    repeatDelay: 0.9,
    defaults: { ease: 'power2.out' },
  });

  tl.fromTo(card, away, { xPercent: 0, yPercent: 0, rotation: -14, duration: 1.3, ease: 'power2.inOut' }, 0.3)
    // two calm pulses
    .fromTo(arcs, { opacity: 0, scale: 0.72 }, pulseIn, 1.35)
    .to(arcs, { opacity: 0, duration: 0.45, stagger: 0.13, ease: 'power1.in' }, 2.05)
    .fromTo(arcs, { opacity: 0, scale: 0.72 }, { ...pulseIn, immediateRender: false }, 2.65)
    .to(arcs, { opacity: 0, duration: 0.5, stagger: 0.13, ease: 'power1.in' }, 3.45)
    // the review page slides up and the stars fill one by one
    .fromTo(review, { yPercent: 101 }, { yPercent: 0, duration: 0.85, ease: 'power3.out' }, 2.75)
    .fromTo(stars, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.42, stagger: 0.17 }, 3.5)
    // hold on the result, then reset quietly
    .to(review, { yPercent: 101, duration: 0.8, ease: 'power2.inOut' }, '+=2.8')
    .to(card, { ...away, duration: 1.2, ease: 'power2.inOut' }, '<');

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
