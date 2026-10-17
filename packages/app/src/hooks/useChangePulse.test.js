import {act, renderHook} from '@testing-library/react';

import useChangePulse from './useChangePulse';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useChangePulse', () => {
	test('stays still on the first render', () => {
		const {result} = renderHook(() => useChangePulse(true));
		expect(result.current).toBe(false);
	});

	test('pulses for a while after the value flips, either way', () => {
		const {result, rerender} = renderHook(({value}) => useChangePulse(value, 450), {initialProps: {value: false}});
		rerender({value: true});
		expect(result.current).toBe(true);
		act(() => jest.advanceTimersByTime(450));
		expect(result.current).toBe(false);
		rerender({value: false});
		expect(result.current).toBe(true);
	});

	test('ignores a render that keeps the same value', () => {
		const {result, rerender} = renderHook(({value}) => useChangePulse(value), {initialProps: {value: true}});
		rerender({value: true});
		expect(result.current).toBe(false);
	});
});
