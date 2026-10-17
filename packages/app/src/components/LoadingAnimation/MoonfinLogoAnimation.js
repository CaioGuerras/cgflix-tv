import {useRef} from 'react';

import css from './LoadingAnimation.module.less';

let nextGradientId = 0;

// CGFLIX: the "C with a play" emblem breathing in and out, the way the site and the other apps
// show a wait, in place of the spinning Moonfin logo. The setting keeps its old key so a saved
// choice still lands here. Only opacity and scale move, which the TV can hand to the compositor.
const MoonfinLogoAnimation = ({size, speed}) => {
	// Gradient ids are shared by the whole document, so each emblem on screen needs its own.
	const gradientId = useRef(null);
	if (!gradientId.current) gradientId.current = `cgflixEmblem${++nextGradientId}`;
	const ringId = gradientId.current + 'Ring';
	const playId = gradientId.current + 'Play';
	const duration = Math.round(1800 / speed) + 'ms';

	return (
		<div
			className={css.logoPulse}
			style={{width: size + 'px', height: size + 'px', WebkitAnimationDuration: duration, animationDuration: duration}}
		>
			<svg viewBox="0 0 1000 1000" width={size} height={size} aria-hidden="true" focusable="false">
				<defs>
					<linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#f3e8ff" />
						<stop offset="0.3" stopColor="#c084fc" />
						<stop offset="0.7" stopColor="#9333ea" />
						<stop offset="1" stopColor="#581c87" />
					</linearGradient>
					<linearGradient id={playId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#ffffff" />
						<stop offset="0.55" stopColor="#ede9fe" />
						<stop offset="1" stopColor="#c4b5fd" />
					</linearGradient>
				</defs>
				<path d="M760.9 281.0A340 340 0 1 0 760.9 719.0" fill="none" stroke={`url(#${ringId})`} strokeWidth="128" strokeLinecap="round" />
				<path d="M452 368L452 632L668 500Z" fill={`url(#${playId})`} stroke={`url(#${playId})`} strokeWidth="54" strokeLinejoin="round" />
			</svg>
		</div>
	);
};

export default MoonfinLogoAnimation;
