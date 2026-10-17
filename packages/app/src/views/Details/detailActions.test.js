// $L reaches for ilib, which a plain unit test has no way to load. Every key is its
// own English source string, so handing the string straight back is faithful enough.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
// The buttons are only read here, never drawn, so Spotlight's wrappers stay out of it.
jest.mock('./detailsSpottables', () => ({SpottableDiv: 'div'}));

import {detailActionCatalogue} from './detailActions';

const button = (props, id) => detailActionCatalogue({seerr: {}, ...props}).find((btn) => btn.id === id).render().props;

describe('detail action catalogue', () => {
	const watchedItem = {Id: 'a', Type: 'Movie', UserData: {Played: true, IsFavorite: true}};

	// Minimalist, Spotlight and Nouveau hand over only the item, so the buttons read its user data.
	it('shows watched and favorite from the item when the screen passes neither', () => {
		expect(button({item: watchedItem}, 'watched')).toMatchObject({label: 'Watched', active: true});
		expect(button({item: watchedItem}, 'favorite')).toMatchObject({label: 'Favorited', active: true});
		expect(button({item: {Id: 'b', UserData: {}}}, 'watched')).toMatchObject({label: 'Mark as Watched', active: false});
	});

	it('lets a screen that passes them decide', () => {
		expect(button({item: watchedItem, played: false}, 'watched')).toMatchObject({label: 'Mark as Watched', active: false});
		expect(button({item: watchedItem, isFavorite: false}, 'favorite')).toMatchObject({label: 'Favorite', active: false});
	});
});
