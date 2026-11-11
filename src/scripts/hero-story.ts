// The hero's story loop, shared by the CSS 3D scene (phones) and the Three.js scene
// (desktop): the card glides in and taps, the arcs pulse, the review page opens,
// the stars fill, then everything returns. One cycle is a little over six seconds.
import gsap from 'gsap';

/** Same curve as --ease-soft in global.css. */
export const SOFT = 'power4.out';

/** Moments in the loop, in seconds. */
export const STORY = {
  glide: 0.2, // the card starts towards the phone
  glideTime: 1.15,
  tap: 1.35, // contact
  pulses: [1.35, 2.1], // the two wave pulses
  wake: 1.85, // the review page slides up
  stars: 2.6, // the first star fills
  leave: 4.75, // the page closes and the card glides back
  leaveTime: 1.25,
  rest: 0.35, // pause before the next cycle
};

export function createStory() {
  return gsap.timeline({ paused: true, repeat: -1, repeatDelay: STORY.rest, defaults: { ease: SOFT } });
}

/**
 * The part that plays on the phone's screen. It is real HTML in both scenes, and it
 * moves with transform only (never opacity on text), so the words stay fully legible.
 */
export function screenStory(timeline: gsap.core.Timeline, scene: HTMLElement) {
  const review = scene.querySelector('[data-s-review]');
  const stars = scene.querySelectorAll('[data-s-star]');
  if (!review) return;

  gsap.set(stars, { transformOrigin: '50% 50%' });
  gsap.set(review, { y: 0, yPercent: 101 });

  timeline
    .fromTo(review, { yPercent: 101 }, { yPercent: 0, duration: 0.9 }, STORY.wake)
    .fromTo(stars, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.45, stagger: 0.16 }, STORY.stars)
    .to(review, { yPercent: 101, duration: 0.8, ease: 'power2.inOut' }, STORY.leave);
}
