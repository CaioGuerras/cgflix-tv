import {scrimStyle} from '../../utils/scrimImage';
import {serverBlurredUrl} from '../../utils/serverBlur';

import css from './Details.module.less';

// Same stops as .backdropGradient in the stylesheet.
const SCRIM = [{to: 'bottom', rgb: '0, 0, 0', stops: [[0, 0.3], [0.3, 0.5], [0.6, 0.85], [0.8, 0.95], [1, 1]]}];

// A person has no artwork worth blurring behind them, so they get the flat panel instead.
const DetailBackdrop = ({backdropUrl, isPerson, blur}) => {
	const blurredUrl = serverBlurredUrl(backdropUrl, blur);
	return (
		<>
			{backdropUrl && !isPerson && (
				<div className={css.backdrop}>
					<img
						src={blurredUrl || backdropUrl}
						className={css.backdropImage}
						alt=""
						style={!blurredUrl && blur > 0 ? {filter: `blur(${blur}px)`} : undefined}
					/>
				</div>
			)}
			{isPerson && <div className={`${css.backdrop} ${css.personBackdrop}`} />}
			<div className={css.backdropGradient} style={scrimStyle(SCRIM)} />
		</>
	);
};

export default DetailBackdrop;
