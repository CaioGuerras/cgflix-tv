// CGFLIX: rows glide to the focused card instead of jumping, as on Apple TV.
//
// A tween of scrollLeft or scrollTop on animation frames, since scroll-behavior
// is missing on the older TVs and can't be retargeted. A new target mid glide
// starts from wherever the lane is, so holding the remote never stalls, and
// asking again for the same target leaves the glide running. Low tier TVs and
// anything without animation frames still jump.

import {getPerfTier} from './perfTier';

export const SMOOTH_SCROLL_MS = 280;

// Close to cubic-bezier(0.2, 0.8, 0.2, 1): quick off the mark, long soft landing.
export const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

const running = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

// Null when the lane has no layout yet, so the target passes through untouched.
const maxScroll = (el, axis) => {
	const total = axis === 'scrollLeft' ? el.scrollWidth : el.scrollHeight;
	if (!total) return null;
	return Math.max(0, total - (axis === 'scrollLeft' ? el.clientWidth : el.clientHeight));
};

// Returns where the lane will come to rest, clamped the way the browser clamps it.
export const smoothScrollTo = (el, axis, target, duration = SMOOTH_SCROLL_MS) => {
	if (!el) return target;
	const max = maxScroll(el, axis);
	const end = max === null ? Math.max(0, target) : Math.min(Math.max(0, target), max);
	const current = running && running.get(el);
	const canAnimate = running && typeof window !== 'undefined' &&
		typeof window.requestAnimationFrame === 'function' && getPerfTier() !== 'low' && duration > 0;

	if (current && current.axis === axis && Math.abs(current.end - end) < 1) return end;
	if (current) {
		window.cancelAnimationFrame(current.frame);
		running.delete(el);
	}

	const start = el[axis];
	if (!canAnimate || Math.abs(start - end) < 1) {
		el[axis] = end;
		return end;
	}

	const tween = {axis, end, frame: 0};
	const began = Date.now();
	const step = () => {
		const t = Math.min(1, (Date.now() - began) / duration);
		el[axis] = start + (end - start) * easeOutQuart(t);
		if (t < 1) {
			tween.frame = window.requestAnimationFrame(step);
		} else {
			running.delete(el);
		}
	};
	running.set(el, tween);
	tween.frame = window.requestAnimationFrame(step);
	return end;
};
