import {useEffect, useState} from 'react';
import $L from '@enact/i18n/$L';

import {fetchTrendingIds, fetchUpcoming} from '../../services/cgflixRowsApi';
import {getItemsByIds, getServerUrl} from '../../services/jellyfinApi';
import {upcomingEntries, buildComingSoonItems} from '../../utils/cgflixRows';

// CGFLIX: the Trending in Brazil and Coming Soon home rows. Both lists come from the server,
// and every library id in them goes out in one request. Kids Mode leaves them out, since
// neither list is picked with children in mind.
const useCgflixRows = ({homeRows, kidsMode}) => {
	const [rows, setRows] = useState([]);
	const [pending, setPending] = useState([]);

	useEffect(() => {
		const enabled = new Set((homeRows || []).filter((row) => row.enabled).map((row) => row.id));
		const wantTrending = !kidsMode && enabled.has('cgflix_emalta');
		const wantUpcoming = !kidsMode && enabled.has('cgflix_embreve');
		if (!wantTrending && !wantUpcoming) {
			setRows([]);
			setPending([]);
			return undefined;
		}

		let cancelled = false;
		setPending([
			...(wantTrending ? [{id: 'cgflix_emalta', title: $L('Trending in Brazil')}] : []),
			...(wantUpcoming ? [{id: 'cgflix_embreve', title: $L('Coming Soon')}] : [])
		]);

		(async () => {
			try {
				const [trending, upcoming] = await Promise.all([
					wantTrending ? fetchTrendingIds() : null,
					wantUpcoming ? fetchUpcoming() : null
				]);
				const entries = upcoming ? upcomingEntries(upcoming) : [];
				const ids = [...new Set([...(trending?.ids || []), ...entries.map((entry) => entry.jf).filter(Boolean)])];
				const libraryById = new Map((await getItemsByIds(ids)).map((item) => [item.Id, item]));

				const built = [];
				const trendingItems = (trending?.ids || []).map((id) => libraryById.get(id)).filter(Boolean);
				if (trendingItems.length > 0) {
					built.push({id: 'cgflix_emalta', title: $L('Trending in Brazil'), items: trendingItems});
				}
				const upcomingItems = buildComingSoonItems(entries, libraryById, getServerUrl());
				if (upcomingItems.length > 0) {
					// Drawn like the calendar rows: a Seerr card opens Seerr, an owned title its page.
					built.push({id: 'cgflix_embreve', title: $L('Coming Soon'), items: upcomingItems, isExternalRow: true, isCalendarRow: true});
				}
				if (!cancelled) setRows(built);
			} catch (err) {
				console.warn('[Browse] Failed to build the CGFLIX rows:', err);
			}
			if (!cancelled) setPending([]);
		})();

		return () => {
			cancelled = true;
		};
	}, [homeRows, kidsMode]);

	return {rows, pending};
};

export default useCgflixRows;
