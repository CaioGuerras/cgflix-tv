import $L from '@enact/i18n/$L';

import css from './holdFeedback.module.less';

// CGFLIX: nothing on a card says that holding OK opens a menu, so the hold shows itself as it
// happens, and the first few times a card keeps focus a hint at the bottom of the screen says so.

export const HINT_DELAY_MS = 1500;
const HINT_VISIBLE_MS = 4000;
// The hint stops for good once it has been shown this many times or the viewer has held OK twice.
export const HINT_SHOW_LIMIT = 5;
export const HINT_USE_LIMIT = 2;
const STORAGE_KEY = 'cgflixHoldHint';

const readCounts = () => {
	try {
		const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
		return {shown: saved.shown || 0, used: saved.used || 0};
	} catch {
		return {shown: 0, used: 0};
	}
};

const writeCounts = (next) => {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Private mode or a full store: the hint just keeps its count for this session.
	}
};

let counts = null;
const getCounts = () => {
	if (!counts) counts = readCounts();
	return counts;
};

const hintWanted = () => {
	const {shown, used} = getCounts();
	return shown < HINT_SHOW_LIMIT && used < HINT_USE_LIMIT;
};

let hintTimer = null;
let hideTimer = null;
let hintNode = null;

const hideHint = () => {
	clearTimeout(hideTimer);
	if (hintNode) hintNode.className = css.hint;
};

const showHint = () => {
	if (!hintWanted() || typeof document === 'undefined') return;
	if (!hintNode) {
		hintNode = document.createElement('div');
		hintNode.setAttribute('data-cgf-hold-hint', '');
		const key = document.createElement('span');
		key.className = css.hintKey;
		key.textContent = 'OK';
		hintNode.appendChild(key);
		hintNode.appendChild(document.createTextNode($L('Hold OK for more options')));
		document.body.appendChild(hintNode);
	}
	// Set apart from the append so the slide in has a starting point to run from.
	hintNode.className = css.hint;
	window.requestAnimationFrame(() => {
		if (hintNode) hintNode.className = `${css.hint} ${css.hintShown}`;
	});
	const current = getCounts();
	counts = {...current, shown: current.shown + 1};
	writeCounts(counts);
	clearTimeout(hideTimer);
	hideTimer = setTimeout(hideHint, HINT_VISIBLE_MS);
};

// A card took focus: the hint comes up if focus is still there after a moment.
export const scheduleHoldHint = () => {
	clearTimeout(hintTimer);
	if (!hintWanted()) return;
	hintTimer = setTimeout(showHint, HINT_DELAY_MS);
};

export const cancelHoldHint = () => {
	clearTimeout(hintTimer);
	hideHint();
};

// A hold opened the menu, so the viewer knows the gesture and the hint can retire.
export const noteHoldUsed = () => {
	cancelHoldHint();
	const current = getCounts();
	counts = {...current, used: current.used + 1};
	writeCounts(counts);
};

// The box the bar sits under: the card's artwork when it has some, the card itself otherwise.
const anchorRect = (target) => {
	const art = target.querySelector && target.querySelector('img');
	const rect = (art || target).getBoundingClientRect();
	return rect.width > 0 ? rect : target.getBoundingClientRect();
};

// Starts the bar filling under `target` over `ms`, and returns what takes it away again.
export const showHoldProgress = (target, ms) => {
	if (!target || typeof document === 'undefined' || !target.getBoundingClientRect) return () => {};
	const rect = anchorRect(target);
	const width = rect.width * 0.7;
	const bar = document.createElement('div');
	bar.className = css.holdBar;
	bar.setAttribute('data-cgf-hold-progress', '');
	bar.style.left = `${rect.left + (rect.width - width) / 2}px`;
	bar.style.width = `${width}px`;
	// Above the card's own watch progress, which sits along its bottom edge.
	bar.style.top = `${rect.bottom - 44}px`;
	const fill = document.createElement('div');
	fill.className = css.holdFill;
	fill.style.setProperty('--cgf-hold-ms', `${ms}ms`);
	bar.appendChild(fill);
	document.body.appendChild(bar);
	return () => {
		if (bar.parentNode) bar.parentNode.removeChild(bar);
	};
};

// For the tests: forget the counts, the timers and the hint node.
export const resetHoldFeedback = () => {
	clearTimeout(hintTimer);
	clearTimeout(hideTimer);
	if (hintNode && hintNode.parentNode) hintNode.parentNode.removeChild(hintNode);
	hintNode = null;
	counts = null;
};
