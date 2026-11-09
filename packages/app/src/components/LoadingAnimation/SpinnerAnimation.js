import {useEffect, useRef} from 'react';

import css from './LoadingAnimation.module.less';

const SWEEP = Math.PI * 1.35;
const TAIL = [55, 48, 76];
const HEAD = [184, 173, 222];

// The arc fades in from nothing to the dim lilac of Shikkoku over its first stretch, then turns to
// the accent toward the head. Past the head, the round end caps included, it stays on the accent.
const arcColor = (t) => {
	if (t > 1) return [HEAD[0], HEAD[1], HEAD[2], 1];
	if (t < 0.45) return [TAIL[0], TAIL[1], TAIL[2], t / 0.45];
	const mix = (t - 0.45) / 0.55;
	return [
		TAIL[0] + ((HEAD[0] - TAIL[0]) * mix),
		TAIL[1] + ((HEAD[1] - TAIL[1]) * mix),
		TAIL[2] + ((HEAD[2] - TAIL[2]) * mix),
		1
	];
};

// Canvas here has no gradient that sweeps around a point, so the arc is shaded a pixel at a
// time, once, and the element holding it turns.
const paintArc = (canvas, size, strokeWidth) => {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const center = size / 2;
	const radius = (size - strokeWidth) / 2;
	const half = strokeWidth / 2;
	const tailX = center + radius;
	const tailY = center;
	const headX = center + (radius * Math.cos(SWEEP));
	const headY = center + (radius * Math.sin(SWEEP));
	const image = ctx.createImageData(size, size);
	const data = image.data;

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = x + 0.5 - center;
			const dy = y + 0.5 - center;
			let angle = Math.atan2(dy, dx);
			if (angle < 0) angle += Math.PI * 2;
			const t = angle / SWEEP;

			let coverage = 0;
			if (t <= 1) {
				coverage = half - Math.abs(Math.sqrt((dx * dx) + (dy * dy)) - radius) + 0.5;
			}
			const toTail = half - Math.sqrt(((x + 0.5 - tailX) * (x + 0.5 - tailX)) + ((y + 0.5 - tailY) * (y + 0.5 - tailY))) + 0.5;
			const toHead = half - Math.sqrt(((x + 0.5 - headX) * (x + 0.5 - headX)) + ((y + 0.5 - headY) * (y + 0.5 - headY))) + 0.5;
			coverage = Math.min(1, Math.max(0, coverage, toTail, toHead));
			if (coverage <= 0) continue;

			const color = arcColor(t);
			const i = ((y * size) + x) * 4;
			data[i] = color[0];
			data[i + 1] = color[1];
			data[i + 2] = color[2];
			data[i + 3] = color[3] * coverage * 255;
		}
	}
	ctx.putImageData(image, 0, 0);
};

// A faint ring with a gradient arc turning around it, once every 1.2 seconds at full speed.
const SpinnerAnimation = ({size, speed}) => {
	const canvasRef = useRef(null);
	const strokeWidth = Math.min(7, Math.max(2.5, size * 0.08));
	const duration = Math.round(1200 / speed) + 'ms';

	useEffect(() => {
		paintArc(canvasRef.current, size, strokeWidth);
	}, [size, strokeWidth]);

	return (
		<div className={css.spinner} style={{width: size + 'px', height: size + 'px'}}>
			<div
				className={css.spinnerTrack}
				style={{borderWidth: strokeWidth + 'px'}}
			/>
			<canvas
				ref={canvasRef}
				className={css.spinnerArc}
				width={size}
				height={size}
				style={{WebkitAnimationDuration: duration, animationDuration: duration}}
			/>
		</div>
	);
};

export default SpinnerAnimation;
