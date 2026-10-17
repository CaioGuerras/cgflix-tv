import {useState, useEffect, useCallback, useRef, memo} from 'react';
import {isMdblistEnabled} from '../../services/mdblistApi';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import {getImageUrl, getBackdropId, formatDuration} from '../../utils/helpers';
import RatingsRow from '../../components/RatingsRow';
import {KEYS} from '../../utils/keys';
import useTrailerPreview from './useTrailerPreview';
import css from './Browse.module.less';
import {carouselIntervalMs} from '../../utils/carouselTiming';
import {autocropLogoUrl} from '../../utils/logoAutocrop';

const FEATURED_GENRES_LIMIT = 2;
const PRELOAD_ADJACENT_SLIDES = 2;
// CGFLIX: two pictures at most are on screen, the one fading in over the one it replaces.
const BACKDROP_LAYERS = 2;
const HERO_LOGO_MAX_WIDTH = 620;
const HERO_LOGO_MAX_HEIGHT = 190;

const backdropUrlFor = (getItemServerUrl, item) => {
	const backdropId = item && getBackdropId(item);
	return backdropId ? getImageUrl(getItemServerUrl(item), backdropId, 'Backdrop', {maxWidth: 1920, quality: 85}) : null;
};

// Resolves once the picture is decoded, so the fade starts on a finished frame rather than
// one the TV is still painting. Older engines without decode() wait for the load instead,
// and a failed load resolves too, which lets the fade show the broken one rather than none.
const whenDecoded = (url) => new Promise((resolve) => {
	const img = new window.Image();
	img.onload = () => {
		if (typeof img.decode === 'function') img.decode().then(resolve, resolve);
		else resolve();
	};
	img.onerror = resolve;
	img.src = url;
});

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const FeaturedBanner = memo(({
	isVisible,
	browseVisible = true,
	featuredItems,
	api,
	settings,
	settingsLoaded,
	getItemServerUrl,
	onSelectItem,
	onNavigateDown,
	onFeaturedFocus,
	uiButtonStyle,
	onCurrentItemChange
}) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [featuredFocused, setFeaturedFocused] = useState(false);

	const preloadedImagesRef = useRef(new Set());
	const carouselIntervalRef = useRef(null);

	const currentFeatured = featuredItems[currentIndex];
	const currentBackdropUrl = backdropUrlFor(getItemServerUrl, currentFeatured);
	const currentLogoUrl = currentFeatured?.LogoUrl || null;

	// CGFLIX: the backdrop never swaps in place. Each new picture is decoded first and then
	// laid over the last one, fading in on its own layer, the way the Apple TV hero turns.
	const [backdropLayers, setBackdropLayers] = useState([]);
	const layerKeyRef = useRef(0);
	useEffect(() => {
		if (!currentBackdropUrl) return undefined;
		let cancelled = false;
		whenDecoded(currentBackdropUrl).then(() => {
			if (cancelled) return;
			setBackdropLayers((prev) => {
				if (prev.length && prev[prev.length - 1].url === currentBackdropUrl) return prev;
				layerKeyRef.current += 1;
				return [...prev, {url: currentBackdropUrl, key: layerKeyRef.current}].slice(-BACKDROP_LAYERS);
			});
		});
		return () => { cancelled = true; };
	}, [currentBackdropUrl]);

	// Studios pad their logos with very different amounts of empty margin, which is what left
	// some of them as a thumbnail in the corner. Trimmed, they all fill the same box.
	const [logo, setLogo] = useState(null);
	useEffect(() => {
		setLogo(null);
		if (!currentLogoUrl) return undefined;
		let cancelled = false;
		autocropLogoUrl(currentLogoUrl).then((result) => {
			if (!cancelled) setLogo({url: result?.url || currentLogoUrl, aspectRatio: result?.aspectRatio || null});
		});
		return () => { cancelled = true; };
	}, [currentLogoUrl]);

	// A trailer outlives the carousel interval, so finishing one moves the hero on
	// itself rather than waiting out another full turn on a still backdrop.
	const handleTrailerEnded = useCallback(() => {
		if (featuredItems.length > 1) setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
	}, [featuredItems.length]);

	const {trailerActive, trailerShowing, trailerHolding, trailerContainerRef} = useTrailerPreview({
		currentItem: currentFeatured,
		// The banner stays mounted behind the settings overlay so the hero keeps its
		// place, but the trailer has to stop or it plays on underneath it.
		isVisible: isVisible && browseVisible,
		enabled: settingsLoaded && settings.featuredTrailerPreview,
		preferMuted: settings.featuredTrailerMuted,
		showCaptions: settings.mediaBarTrailerCaptions,
		captionLanguage: settings.uiLanguage,
		api,
		getItemServerUrl,
		onEnded: handleTrailerEnded
	});

	useEffect(() => {
		if (featuredItems[currentIndex]) {
			onCurrentItemChange?.(featuredItems[currentIndex]);
		}
	}, [currentIndex, featuredItems, onCurrentItemChange]);

	useEffect(() => {
		setCurrentIndex(0);
		preloadedImagesRef.current.clear();
	}, [featuredItems]);

	useEffect(() => {
		if (featuredItems.length === 0) return;

		const preloadImage = (url) => {
			if (!url || preloadedImagesRef.current.has(url)) return;
			const img = new window.Image();
			img.src = url;
			preloadedImagesRef.current.add(url);
		};

		for (let offset = -PRELOAD_ADJACENT_SLIDES; offset <= PRELOAD_ADJACENT_SLIDES; offset++) {
			const index = (currentIndex + offset + featuredItems.length) % featuredItems.length;
			const item = featuredItems[index];
			if (item) {
				// The same url the hero shows, so the preload is the picture it ends up using.
				preloadImage(backdropUrlFor(getItemServerUrl, item));
				if (item.LogoUrl) {
					preloadImage(item.LogoUrl);
				}
			}
		}
	}, [currentIndex, featuredItems, getItemServerUrl]);

	const startCarouselTimer = useCallback(() => {
		if (carouselIntervalRef.current) {
			clearInterval(carouselIntervalRef.current);
			carouselIntervalRef.current = null;
		}

		const carouselSpeed = carouselIntervalMs(
			settings.autoAdvance,
			settings.autoAdvanceInterval,
			settings.carouselSpeed
		);
		if (!isVisible || featuredItems.length <= 1 || !featuredFocused || carouselSpeed <= 0 || trailerHolding) return;

		carouselIntervalRef.current = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
		}, carouselSpeed);
	}, [isVisible, featuredItems.length, featuredFocused, settings.autoAdvance, settings.autoAdvanceInterval, settings.carouselSpeed, trailerHolding]);

	useEffect(() => {
		const carouselSpeed = carouselIntervalMs(
			settings.autoAdvance,
			settings.autoAdvanceInterval,
			settings.carouselSpeed
		);
		if (!isVisible || featuredItems.length <= 1 || !featuredFocused || carouselSpeed <= 0 || trailerHolding) return;
		startCarouselTimer();
		return () => {
			if (carouselIntervalRef.current) {
				clearInterval(carouselIntervalRef.current);
				carouselIntervalRef.current = null;
			}
		};
	}, [isVisible, featuredItems.length, featuredFocused, settings.autoAdvance, settings.autoAdvanceInterval, settings.carouselSpeed, trailerHolding, startCarouselTimer]);

	const handleFeaturedPrev = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentIndex((prev) =>
			prev === 0 ? featuredItems.length - 1 : prev - 1
		);
		startCarouselTimer();
	}, [featuredItems.length, startCarouselTimer]);

	const handleFeaturedNext = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentIndex((prev) =>
			(prev + 1) % featuredItems.length
		);
		startCarouselTimer();
	}, [featuredItems.length, startCarouselTimer]);

	const handleFeaturedKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			if (settings.navbarPosition === 'left') {
				Spotlight.focus('navbar');
			} else {
				handleFeaturedPrev();
			}
		} else if (e.keyCode === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			handleFeaturedNext();
		} else if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (settings.navbarPosition !== 'left') {
				Spotlight.focus('navbar-home');
			}
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			setFeaturedFocused(false);
			onNavigateDown?.();
		}
	}, [handleFeaturedPrev, handleFeaturedNext, settings.navbarPosition, onNavigateDown]);

	const handleFeaturedClick = useCallback(() => {
		const item = featuredItems[currentIndex];
		if (item) onSelectItem(item);
	}, [featuredItems, currentIndex, onSelectItem]);

	const handleFeaturedFocus = useCallback(() => {
		setFeaturedFocused(true);
		onFeaturedFocus?.();
	}, [onFeaturedFocus]);

	const handleFeaturedBlur = useCallback(() => {
		setFeaturedFocused(false);
	}, []);

	const handleCarouselPrevClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedPrev();
	}, [handleFeaturedPrev]);

	const handleCarouselNextClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedNext();
	}, [handleFeaturedNext]);

	if (!isVisible || !currentFeatured) return null;

	const duration = currentFeatured.RunTimeTicks && currentFeatured.Type !== 'Series'
		? formatDuration(currentFeatured.RunTimeTicks)
		: null;
	const metaParts = [
		...(currentFeatured.Genres || []).slice(0, FEATURED_GENRES_LIMIT),
		currentFeatured.ProductionYear,
		duration && duration !== '0m' ? duration : null
	].filter(Boolean);
	// A trimmed logo is sized off its own shape, so a wide wordmark and a tall stacked one
	// cover about the same area instead of the wide one towering over the text.
	const logoStyle = logo?.aspectRatio
		? {width: `${Math.min(HERO_LOGO_MAX_WIDTH, HERO_LOGO_MAX_HEIGHT * logo.aspectRatio)}px`}
		: null;

	return (
		<div className={css.featuredBanner}>
			<SpottableDiv
				className={`${css.featuredInner} ${trailerShowing ? css.trailerShowing : ''} ${trailerActive ? css.trailerActive : ''}`}
				spotlightId="featured-banner"
				onClick={handleFeaturedClick}
				onKeyDown={handleFeaturedKeyDown}
				onFocus={handleFeaturedFocus}
				onBlur={handleFeaturedBlur}
			>
				<div className={css.featuredBackdrop}>
					{backdropLayers.map((layer) => (
						<img key={layer.key} className={css.heroLayer} src={layer.url} alt="" />
					))}
				</div>

				<div className={css.trailerContainer} ref={trailerContainerRef} />

				<div className={css.featuredGradient} />

				{featuredItems.length > 1 && (
					<>
						{settings.navbarPosition !== 'left' && (
							<SpottableButton
								className={`${css.carouselNav} ${css.carouselNavLeft} ${css.heroNav}`}
								onClick={handleCarouselPrevClick}
								style={uiButtonStyle}
							>
								<svg viewBox="0 0 24 24" width="32" height="32">
									<path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
								</svg>
							</SpottableButton>
						)}
						<SpottableButton
							className={`${css.carouselNav} ${css.carouselNavRight} ${css.heroNav}`}
							onClick={handleCarouselNextClick}
							style={uiButtonStyle}
						>
							<svg viewBox="0 0 24 24" width="32" height="32">
								<path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
							</svg>
						</SpottableButton>
					</>
				)}

				{/* Keyed by the item, so every turn replays the fade in rather than
				    swapping the text under the reader's eyes. */}
				<div key={currentFeatured.Id} className={css.featuredContent}>
					<div className={css.featuredLogoContainer}>
						{currentLogoUrl ? (
							logo && (
								<img
									className={css.heroLogoImg}
									src={logo.url}
									style={logoStyle}
									alt={currentFeatured.Name}
								/>
							)
						) : (
							<h1 className={css.featuredTitle}>{currentFeatured.Name}</h1>
						)}
					</div>
					<div className={css.featuredDetails}>
						<div className={css.featuredMeta}>
							{metaParts.map((part) => (
								<span key={part} className={css.metaItem}>{part}</span>
							))}
							{currentFeatured.OfficialRating && (
								<span className={css.metaBadge}>{currentFeatured.OfficialRating}</span>
							)}
						</div>
						<RatingsRow item={currentFeatured} serverUrl={getItemServerUrl(currentFeatured)} compact pluginEnabled={isMdblistEnabled(settings)} />
						{!settings.hideHomeMediaDescription && currentFeatured.Overview && (
							<p className={css.featuredOverview}>{currentFeatured.Overview}</p>
						)}
					</div>
				</div>

				{featuredItems.length > 1 && (
					<div className={css.featuredIndicators}>
						{featuredItems.map((item, idx) => (
							<div
								key={item.Id || idx}
								className={`${css.indicatorDot} ${idx === currentIndex ? css.active : ''}`}
							/>
						))}
					</div>
				)}
			</SpottableDiv>
		</div>
	);
});

export default FeaturedBanner;
