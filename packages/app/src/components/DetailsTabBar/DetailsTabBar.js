import {useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

import {pointerHover} from '../../utils/focusScroll';

import css from './DetailsTabBar.module.less';

const Pill = Spottable('div');
const TabContainer = SpotlightContainerDecorator({restrict: 'self-first'}, 'div');

// How much of the next tab stays in view past the focused one, so there is a hint of more.
const TRACK_CLEARANCE = 60;

// A d-pad focusable pill tab bar. The pill highlight and focus states are all in
// CSS, so navigating left and right only moves focus and reports the active id.
const DetailsTabBar = ({tabs, activeId, activeSpotlightId, onSelect, onActivate, expanded = true, spotlightId, className, scrollTrack = false}) => {
	const handleClick = useCallback((ev) => {
		const id = ev.currentTarget.dataset.id;
		if (id) onActivate?.(id);
	}, [onActivate]);

	const handleFocus = useCallback((ev) => {
		// With Expanded Tabs on, focus follows selection. Otherwise a tab only
		// opens when it's clicked. A pointer sweeping across the bar would flip
		// the content on every tab it crossed, so it has to click as well.
		if (!expanded || pointerHover()) return;
		const id = ev.currentTarget.dataset.id;
		if (id) onSelect?.(id);
	}, [expanded, onSelect]);

	// CGFLIX: a long run of seasons is wider than the screen. With scrollTrack the bar scrolls
	// inside its own clipped track, so the focused tab is brought into view here rather than by
	// the browser, which slid the whole details page sideways to reach it (Caio, 17/10).
	const trackRef = useRef(null);
	const handleTrackFocus = useCallback((ev) => {
		if (Spotlight.getPointerMode()) return;
		const track = trackRef.current;
		const tab = ev.target;
		if (!track || !tab) return;
		window.requestAnimationFrame(() => {
			const view = track.getBoundingClientRect();
			const box = tab.getBoundingClientRect();
			if (box.left < view.left + TRACK_CLEARANCE) {
				track.scrollLeft -= view.left + TRACK_CLEARANCE - box.left;
			} else if (box.right > view.right - TRACK_CLEARANCE) {
				track.scrollLeft += box.right - view.right + TRACK_CLEARANCE;
			}
		});
	}, []);

	if (!tabs || tabs.length === 0) return null;

	const bar = (
		<TabContainer className={`${css.tabBar} ${className || ''}`} spotlightId={spotlightId}>
			{tabs.map((tab) => (
				<Pill
					key={tab.id}
					spotlightId={tab.id === activeId ? activeSpotlightId : undefined}
					data-id={tab.id}
					className={`${css.tab} ${tab.id === activeId ? css.tabActive : ''}`}
					onClick={handleClick}
					onFocus={handleFocus}
				>
					{tab.label}
				</Pill>
			))}
		</TabContainer>
	);

	return scrollTrack
		? <div className={css.track} ref={trackRef} onFocus={handleTrackFocus}>{bar}</div>
		: bar;
};

export default DetailsTabBar;
