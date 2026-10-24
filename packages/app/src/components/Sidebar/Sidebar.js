import {supportsFavorites} from '../../utils/serverCapabilities';
import {memo, useCallback, useMemo} from 'react';
import $L from '@enact/i18n/$L';
import SpotlightContainerDecorator, {spotlightDefaultClass} from '@enact/spotlight/SpotlightContainerDecorator';
import {useSettings} from '../../context/SettingsContext';
import {useSyncPlay} from '../../context/SyncPlayContext';
import {useServerMessages} from '../../context/ServerMessagesContext';
import {useAchievements} from '../../context/AchievementsContext';
import SyncPlayIcon from '../icons/SyncPlayIcon';
import {FavoritesIcon, FriendsIcon, GenresIcon, HomeIcon, LiveTvIcon, MessagesIcon, SearchIcon, SettingsIcon, ShuffleIcon} from '../icons/navIcons';
import useClock from '../../hooks/useClock';
import {librariesForNav} from '../../utils/liveTvLibrary';
import {isKidsMode} from '../../utils/kidsMode';
import {shadowToCss, toCssColor, toCssColorWithAlpha} from '../../theme/themeSpec';
import {SIDEBAR_CONTENT_FOCUS_TARGETS, focusFirstContentTarget} from '../../utils/navFocusTargets';
import {KEYS} from '../../utils/keys';
import SidebarItem from './SidebarItem';
import SidebarLibraries from './SidebarLibraries';
import SidebarUserButton from './SidebarUserButton';
import useSidebarExpansion from './useSidebarExpansion';

import css from './Sidebar.module.less';

const SidebarContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	preserveId: true
}, 'nav');

// Up and down at the ends of the rail would otherwise leak out to whatever sits
// behind it, so those two presses get swallowed.
const trapVerticalEdges = (e) => {
	const items = Array.from(e.currentTarget.querySelectorAll('[data-spotlight-id], .spottable'))
		.filter(el => el.offsetParent !== null);
	if (items.length === 0) return;
	const focused = document.activeElement;
	const edge = e.keyCode === KEYS.UP ? items[0] : items[items.length - 1];
	if (focused === edge || edge.contains(focused)) {
		e.preventDefault();
		e.stopPropagation();
	}
};

const Sidebar = ({
	libraries = [],
	hasLiveTv = false,
	onHome,
	onSearch,
	onShuffle,
	onGenres,
	onFavorites,
	onLiveTv,
	onSettings,
	onSelectLibrary,
	onUserMenu,
	onSyncPlay,
	onMessages,
	onFriends
}) => {
	const {settings, activeTheme} = useSettings();
	const {isInGroup} = useSyncPlay();
	const {messages, unreadCount} = useServerMessages();
	const {socialAvailable, badgeCount: friendsBadge} = useAchievements();
	// The nav bar has always honoured this; the sidebar rendered the clock
	// whatever the setting said, and kept it ticking too.
	const showClock = settings.showClock !== false;
	const clock = useClock(showClock);
	const {expanded, librariesExpanded, toggleLibraries, handlers} = useSidebarExpansion();

	const showShuffle = settings.showShuffleButton !== false;
	const showGenres = settings.showGenresButton !== false;
	// CGFLIX: servidor Plex não tem favoritos
	const showFavorites = settings.showFavoritesButton !== false && supportsFavorites(null);
	const kidsMode = isKidsMode(settings);
	const showLiveTv = !kidsMode && settings.showLiveTvButton !== false && hasLiveTv;
	const showSyncPlay = !kidsMode && settings.syncplayEnabled !== false && settings.showSyncPlayButton !== false;
	const navLibraries = librariesForNav(libraries, showLiveTv, {hideLiveTv: kidsMode});
	const showLibraries = !kidsMode && settings.showLibrariesInToolbar !== false && navLibraries.length > 0;
	// Only with something to show, so the rail never has a row that does nothing.
	const showMessages = settings.showServerMessagesButton === true && messages.length > 0;
	// Only where the Achievement Badges plugin has friends switched on, so it never takes a
	// colour slot for a button that cant open.
	const showFriends = !kidsMode && socialAvailable && settings.showFriendsButton === true;

	const navStyle = useMemo(() => {
		// CGFLIX: the floating panel takes the theme surface, a touch see through,
		// whether collapsed or open. It deepens a little when open so the labels read.
		const panel = toCssColorWithAlpha(activeTheme.colors.surface, expanded ? 0.94 : 0.86);
		return {
			background: panel,
			backdropFilter: 'none',
			WebkitBackdropFilter: 'none',
			borderBottom: activeTheme.borders.navBorder
				? `${activeTheme.borders.navBorder.width}px solid ${toCssColor(activeTheme.borders.navBorder.color)}`
				: 'none',
			color: toCssColor(activeTheme.colors.onSurface),
			textShadow: activeTheme.textGlow.length ? activeTheme.textGlow.map(shadowToCss).join(', ') : 'none'
		};
	}, [activeTheme, expanded]);

	const handleNavKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			focusFirstContentTarget(SIDEBAR_CONTENT_FOCUS_TARGETS, 'right');
		} else if (e.keyCode === KEYS.UP || e.keyCode === KEYS.DOWN) {
			trapVerticalEdges(e);
		}
	}, []);

	// Slots hand out the theme's nav color cycle in the order items actually
	// render, so hiding a button never doubles a color on its neighbours.
	let slot = 0;
	const nextSlot = () => {
		slot += 1;
		return slot;
	};

	return (
		<SidebarContainer
			className={`${css.sidebar} ${expanded ? css.expanded : ''}`}
			style={navStyle}
			onKeyDown={handleNavKeyDown}
			onMouseEnter={handlers.onMouseEnter}
			onMouseLeave={handlers.onMouseLeave}
			onFocus={handlers.onFocus}
			onBlur={handlers.onBlur}
			spotlightId="navbar"
		>
			<div className={css.userSection}>
				<SidebarUserButton onClick={onUserMenu} />
			</div>

			<div className={css.navSection}>
				<div className={css.navItems}>
					<SidebarItem Icon={HomeIcon} slot={nextSlot()} label={$L('Home')} onClick={onHome} spotlightId="navbar-home" className={spotlightDefaultClass} />
					<SidebarItem Icon={SearchIcon} slot={nextSlot()} label={$L('Search')} onClick={onSearch} />

					{showShuffle && (
						<SidebarItem Icon={ShuffleIcon} slot={nextSlot()} label={$L('Shuffle')} onClick={onShuffle} />
					)}

					{showGenres && (
						<SidebarItem Icon={GenresIcon} slot={nextSlot()} label={$L('Genres')} onClick={onGenres} />
					)}

					{showFavorites && (
						<SidebarItem Icon={FavoritesIcon} slot={nextSlot()} label={$L('Favorites')} onClick={onFavorites} />
					)}

					{showLiveTv && (
						<SidebarItem Icon={LiveTvIcon} slot={nextSlot()} label={$L('Live TV')} onClick={onLiveTv} />
					)}


					{showSyncPlay && (
						<SidebarItem Icon={SyncPlayIcon} slot={nextSlot()} label={$L('SyncPlay')} onClick={onSyncPlay} active={isInGroup} />
					)}

					{showLibraries && (
						<SidebarLibraries
							libraries={navLibraries}
							slot={nextSlot()}
							expanded={librariesExpanded}
							onToggle={toggleLibraries}
							onSelectLibrary={onSelectLibrary}
						/>
					)}

					{showMessages && (
						<SidebarItem Icon={MessagesIcon} slot={nextSlot()} label={$L('Messages')} onClick={onMessages} spotlightId="navbar-messages" badge={unreadCount} />
					)}
					{showFriends && (
						<SidebarItem Icon={FriendsIcon} slot={nextSlot()} label={$L('Friends')} onClick={onFriends} spotlightId="navbar-friends" badge={friendsBadge} />
					)}

					<SidebarItem Icon={SettingsIcon} slot={nextSlot()} label={$L('Settings')} onClick={onSettings} spotlightId="navbar-settings" />
				</div>
			</div>

			{showClock && (
				<div className={css.footerSection}>
					<div className={css.clock}>{clock}</div>
				</div>
			)}
		</SidebarContainer>
	);
};

export default memo(Sidebar);
