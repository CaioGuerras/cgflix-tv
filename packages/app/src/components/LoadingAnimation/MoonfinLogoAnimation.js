import css from './LoadingAnimation.module.less';

// Heisuca: the red seal (the brand's small mark) breathing in and out while a page or a video
// loads. The setting keeps its old key so a saved choice still lands here. Only opacity and scale
// move, which the TV can hand to the compositor. The seal is the one place red lives besides the
// icon and the logo, so it keeps its own colors in both themes.
const MoonfinLogoAnimation = ({size, speed}) => {
	const duration = Math.round(1800 / speed) + 'ms';

	return (
		<div
			className={css.logoPulse}
			style={{width: size + 'px', height: size + 'px', WebkitAnimationDuration: duration, animationDuration: duration}}
		>
			<svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true" focusable="false">
				<path d="M102.40,0.00H921.60A102.40,102.40 0 0 1 1024.00,102.40V921.60A102.40,102.40 0 0 1 921.60,1024.00H102.40A102.40,102.40 0 0 1 0.00,921.60V102.40A102.40,102.40 0 0 1 102.40,0.00Z" fill="#C84127" />
				<path transform="translate(71.68,846.64) scale(0.88064)" d="M403 -823H957V-689H403ZM815 -606H951V-46Q951 -2 941.0 25.5Q931 53 903 70Q875 86 839.0 90.0Q803 94 756 94Q752 66 738.5 28.5Q725 -9 711 -34Q736 -32 762.0 -32.0Q788 -32 798 -32Q808 -32 811.5 -35.5Q815 -39 815 -49ZM419 -606H890V-477H552V95H419ZM167 -839H298V-499Q298 -422 292.0 -343.0Q286 -264 267.5 -187.5Q249 -111 212.0 -41.0Q175 29 113 89Q103 73 86.5 52.5Q70 32 52.0 13.5Q34 -5 19 -16Q69 -66 98.5 -124.0Q128 -182 143.0 -245.0Q158 -308 162.5 -372.5Q167 -437 167 -500ZM52 -640 151 -628Q154 -581 151.5 -530.5Q149 -480 140.5 -432.5Q132 -385 116 -348L17 -389Q31 -419 39.0 -461.0Q47 -503 50.0 -550.0Q53 -597 52 -640ZM334 -692 455 -646Q429 -593 404.0 -536.5Q379 -480 358 -441L272 -480Q284 -509 296.0 -546.0Q308 -583 318.0 -621.5Q328 -660 334 -692ZM276 -312Q288 -300 309.5 -273.0Q331 -246 355.0 -214.0Q379 -182 399.0 -155.0Q419 -128 428 -117L328 -19Q315 -45 297.0 -75.5Q279 -106 259.0 -138.0Q239 -170 220.0 -198.5Q201 -227 186 -248ZM617 -774H753V-490H617ZM617 -533 714 -521Q708 -437 695.0 -361.5Q682 -286 658.0 -225.5Q634 -165 593 -125Q580 -148 557.0 -177.0Q534 -206 514 -222Q548 -251 568.0 -299.5Q588 -348 599.5 -408.5Q611 -469 617 -533ZM750 -530Q758 -471 771.5 -413.5Q785 -356 806.0 -308.0Q827 -260 856 -228Q836 -212 810.5 -183.0Q785 -154 771 -130Q737 -172 714.5 -232.5Q692 -293 678.5 -365.0Q665 -437 656 -513Z" fill="#FFF8F0" />
			</svg>
		</div>
	);
};

export default MoonfinLogoAnimation;
