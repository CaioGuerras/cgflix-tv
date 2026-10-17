import {fireEvent, render, renderHook, screen} from '@testing-library/react';

import useItemMenuHold from './useItemMenuHold';
import {HINT_DELAY_MS, HINT_SHOW_LIMIT, resetHoldFeedback} from '../components/ItemContextMenu/holdFeedback';

const mockMenu = {open: jest.fn(), canOpen: jest.fn(() => true)};

// The CLI ships a second copy of React, so the test card's JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {jsxDEV: (type, props, key) => React.createElement(type, key === undefined ? props : {...props, key})};
});

jest.mock('../components/ItemContextMenu', () => ({useItemMenu: () => mockMenu}));
jest.mock('../platform', () => ({getPlatform: () => 'vega'}));

const ITEM = {Id: 'm1', Type: 'Movie'};
const OK = 13;
const LEFT = 37;
const MENU = 93;

const card = document.createElement('div');

const press = (code = OK) => ({keyCode: code, which: code, target: card});

// A key let go on the window, the way it arrives wherever focus has moved to by then.
const release = (type, code = OK) => {
	const event = new window.Event(type, {bubbles: true, cancelable: true});
	Object.defineProperty(event, 'keyCode', {get: () => code});
	Object.defineProperty(event, 'which', {get: () => code});
	window.dispatchEvent(event);
	return event;
};

const setup = () => renderHook(() => useItemMenuHold(() => ITEM)).result.current;

// Spotlight turns a keyup into a click only when nothing marked it handled on the way down.
const HoldableCard = ({onClick}) => {
	const hold = useItemMenuHold(() => ITEM);
	const handleKeyUp = (e) => {
		if (!e.defaultPrevented) onClick();
	};
	return <div {...hold} data-testid="card" tabIndex={0} onKeyUp={handleKeyUp} />;
};

const sendKey = (type, element) => fireEvent[type](element, {keyCode: OK, which: OK});

beforeEach(() => {
	jest.useFakeTimers();
	window.localStorage.clear();
	resetHoldFeedback();
	mockMenu.open.mockClear();
	mockMenu.canOpen.mockClear();
	mockMenu.canOpen.mockReturnValue(true);
});

afterEach(() => {
	jest.useRealTimers();
});

describe('useItemMenuHold', () => {
	test('a hold opens the menu and its release is kept from becoming a click', () => {
		const hold = setup();

		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(600);

		expect(mockMenu.open).toHaveBeenCalledWith(ITEM, undefined);
		expect(release('keyup').defaultPrevented).toBe(true);
	});

	test('the menu key opens the menu at once and is marked handled', () => {
		const hold = setup();
		const event = {...press(MENU), preventDefault: jest.fn(), stopPropagation: jest.fn()};

		hold.onKeyDownCapture(event);

		expect(mockMenu.open).toHaveBeenCalledWith(ITEM, undefined);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopPropagation).toHaveBeenCalled();
	});

	test('the menu key leaves a card the menu cant open for alone', () => {
		mockMenu.canOpen.mockReturnValue(false);
		const hold = setup();
		const event = {...press(MENU), preventDefault: jest.fn(), stopPropagation: jest.fn()};

		hold.onKeyDownCapture(event);

		expect(mockMenu.open).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	test('the keydowns a remote repeats while OK is held start nothing new', () => {
		const hold = setup();

		hold.onKeyDownCapture(press());
		for (let i = 0; i < 30; i++) {
			jest.advanceTimersByTime(50);
			hold.onKeyDownCapture(press());
		}
		jest.advanceTimersByTime(2000);

		expect(mockMenu.open).toHaveBeenCalledTimes(1);
	});

	test('a short press opens nothing and its release stays a click', () => {
		const hold = setup();

		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(200);
		const up = release('keyup');
		jest.advanceTimersByTime(1000);

		expect(up.defaultPrevented).toBe(false);
		expect(mockMenu.open).not.toHaveBeenCalled();
	});

	test('another key let go in the middle leaves the hold running', () => {
		const hold = setup();

		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(300);
		release('keyup', LEFT);
		jest.advanceTimersByTime(300);

		expect(mockMenu.open).toHaveBeenCalledTimes(1);
	});

	test('the next press after a hold is an ordinary one again', () => {
		const hold = setup();

		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(600);
		release('keyup');
		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(100);

		expect(release('keyup').defaultPrevented).toBe(false);
	});

	test('a pointer hold swallows the click it lets go with, wherever that lands', () => {
		const hold = setup();
		const clicked = jest.fn();
		document.addEventListener('click', clicked);

		hold.onMouseDownCapture({target: card});
		jest.advanceTimersByTime(600);
		hold.onMouseLeave();
		release('mouseup');
		document.body.click();
		document.body.click();

		expect(mockMenu.open).toHaveBeenCalledTimes(1);
		expect(clicked).toHaveBeenCalledTimes(1);
		document.removeEventListener('click', clicked);
	});

	test('leaving the card before the hold calls it off', () => {
		const hold = setup();

		hold.onMouseDownCapture({target: card});
		jest.advanceTimersByTime(300);
		hold.onMouseLeave();
		jest.advanceTimersByTime(600);

		expect(mockMenu.open).not.toHaveBeenCalled();
	});

	test('a card with nothing in its menu is left to its click', () => {
		mockMenu.canOpen.mockReturnValue(false);
		const hold = setup();

		hold.onKeyDownCapture(press());
		jest.advanceTimersByTime(600);

		expect(mockMenu.open).not.toHaveBeenCalled();
		expect(release('keyup').defaultPrevented).toBe(false);
	});

	test('a card opens on a press and not on the release of a hold', () => {
		const onClick = jest.fn();
		render(<HoldableCard onClick={onClick} />);
		const element = screen.getByTestId('card');

		sendKey('keyDown', element);
		sendKey('keyUp', element);
		expect(onClick).toHaveBeenCalledTimes(1);

		sendKey('keyDown', element);
		jest.advanceTimersByTime(600);
		sendKey('keyUp', element);
		expect(mockMenu.open).toHaveBeenCalledTimes(1);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	// CGFLIX: the hold shows itself, and a hint says it exists.
	describe('feedback', () => {
		const bar = () => document.querySelector('[data-cgf-hold-progress]');
		const hint = () => document.querySelector('[data-cgf-hold-hint]');
		const hintShown = () => Boolean(hint()) && hint().className.split(' ').length > 1;
		const focusCard = (hold) => {
			hold.onFocusCapture({target: card});
			// The delay, then a frame for the slide in.
			jest.advanceTimersByTime(HINT_DELAY_MS + 50);
		};

		test('a bar fills under the card while OK is held, gone once the menu opens', () => {
			const hold = setup();
			hold.onKeyDownCapture(press());
			expect(bar()).not.toBeNull();
			jest.advanceTimersByTime(600);
			expect(mockMenu.open).toHaveBeenCalledTimes(1);
			expect(bar()).toBeNull();
		});

		test('a short press takes its bar away with it', () => {
			const hold = setup();
			hold.onKeyDownCapture(press());
			release('keyup');
			expect(bar()).toBeNull();
		});

		test('a card that keeps focus brings up the hint, and leaving it puts it away', () => {
			const hold = setup();
			focusCard(hold);
			expect(hintShown()).toBe(true);
			hold.onBlurCapture();
			expect(hintShown()).toBe(false);
		});

		test('moving on before the delay shows nothing', () => {
			const hold = setup();
			hold.onFocusCapture({target: card});
			jest.advanceTimersByTime(HINT_DELAY_MS - 100);
			hold.onBlurCapture();
			jest.advanceTimersByTime(HINT_DELAY_MS);
			expect(hint()).toBeNull();
		});

		test('the hint retires after a few showings', () => {
			const hold = setup();
			for (let i = 0; i < HINT_SHOW_LIMIT; i++) {
				focusCard(hold);
				hold.onBlurCapture();
			}
			focusCard(hold);
			expect(hintShown()).toBe(false);
		});

		test('the hint retires once the viewer has held OK twice', () => {
			const hold = setup();
			for (let i = 0; i < 2; i++) {
				hold.onKeyDownCapture(press());
				jest.advanceTimersByTime(600);
				release('keyup');
			}
			focusCard(hold);
			expect(hint()).toBeNull();
		});

		test('a card the menu cant open for gets no hint', () => {
			mockMenu.canOpen.mockReturnValue(false);
			const hold = setup();
			focusCard(hold);
			expect(hint()).toBeNull();
		});
	});
});
