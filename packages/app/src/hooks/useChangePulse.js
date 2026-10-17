import {useEffect, useRef, useState} from 'react';

// CGFLIX: true for `ms` after `value` changes, so a control can play a short animation
// when the thing it toggles flips. The first render never pulses, only a change does.
const useChangePulse = (value, ms = 450) => {
	const [pulsing, setPulsing] = useState(false);
	const previousRef = useRef(value);

	useEffect(() => {
		if (previousRef.current === value) return undefined;
		previousRef.current = value;
		setPulsing(true);
		const timer = setTimeout(() => setPulsing(false), ms);
		return () => clearTimeout(timer);
	}, [value, ms]);

	return pulsing;
};

export default useChangePulse;
