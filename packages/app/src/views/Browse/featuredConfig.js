// The settings that decide what the media bar holds, and whether it draws from every server. A
// setting missing here won't redraw the bar when it changes.
export const featuredConfigKey = (settings = {}, unifiedMode) => JSON.stringify([
	unifiedMode === true,
	settings.useMoonfinPlugin === true,
	settings.mediaBarSourceType || 'library',
	settings.featuredContentType ?? null,
	settings.featuredItemCount ?? null,
	settings.mediaBarLibraryIds || [],
	settings.mediaBarCollectionIds || [],
	settings.excludedGenres || []
]);

// CGFLIX: the home has one hero, ours, the same as the site and the other apps. Whatever style a
// synced profile or the setup wizard left behind lands on it, and off still turns it off.
export const cgflixFeaturedStyle = (style) => (style === 'off' ? 'off' : 'moonfin');
