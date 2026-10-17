import {applyPerfTier} from './perfTier';
import {easeOutQuart, smoothScrollTo} from './smoothScroll';

const lane = (scrollWidth, clientWidth) => ({scrollLeft: 0, scrollWidth, clientWidth});

describe('smoothScrollTo', () => {
	let frames;
	let now;

	beforeEach(() => {
		frames = [];
		now = 0;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
		jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
		applyPerfTier('high');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		applyPerfTier(null);
	});

	const runFrames = (ms) => {
		now += ms;
		const pending = frames;
		frames = [];
		pending.forEach((cb) => cb());
	};

	test('eases from where the lane is to the target', () => {
		const el = lane(2000, 500);
		expect(smoothScrollTo(el, 'scrollLeft', 400)).toBe(400);
		runFrames(70);
		expect(el.scrollLeft).toBeGreaterThan(0);
		expect(el.scrollLeft).toBeLessThan(400);
		runFrames(300);
		expect(el.scrollLeft).toBe(400);
		expect(frames).toHaveLength(0);
	});

	test('clamps the target the way the browser would', () => {
		const el = lane(800, 500);
		expect(smoothScrollTo(el, 'scrollLeft', 900)).toBe(300);
	});

	test('a new target mid glide starts from the current spot', () => {
		const el = lane(2000, 500);
		smoothScrollTo(el, 'scrollLeft', 400);
		runFrames(100);
		const mid = el.scrollLeft;
		smoothScrollTo(el, 'scrollLeft', 800);
		runFrames(1);
		expect(el.scrollLeft).toBeGreaterThanOrEqual(mid);
		runFrames(400);
		expect(el.scrollLeft).toBe(800);
	});

	test('asking again for the same target keeps the glide going', () => {
		const el = lane(2000, 500);
		smoothScrollTo(el, 'scrollLeft', 400);
		smoothScrollTo(el, 'scrollLeft', 400);
		expect(frames).toHaveLength(1);
	});

	test('low tier TVs jump straight there', () => {
		applyPerfTier('low');
		const el = lane(2000, 500);
		smoothScrollTo(el, 'scrollLeft', 400);
		expect(el.scrollLeft).toBe(400);
		expect(frames).toHaveLength(0);
	});

	test('the curve starts fast and lands at 1', () => {
		expect(easeOutQuart(0)).toBe(0);
		expect(easeOutQuart(0.25)).toBeGreaterThan(0.6);
		expect(easeOutQuart(1)).toBe(1);
	});
});
