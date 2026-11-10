import {readAccentRgb, dimRgb} from '../../utils/runtimeAccent';

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// The runner wears the active theme accent; the far-side limbs are a darker shade of it.
export const runnerColors = () => {
	const accent = readAccentRgb();
	return {lead: rgb(accent), trail: rgb(dimRgb(accent, 0.64))};
};
