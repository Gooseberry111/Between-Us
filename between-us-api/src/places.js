/*
 * ==========================================
 * PLACES
 * ==========================================
 *
 * Somewhere to go, near where you are. Free, open sources
 * only -- no key, no card on file:
 *
 *   OpenStreetMap (Overpass)   what is nearby: restaurants,
 *                              cafés, parks, cinemas...
 *   Wikimedia Commons          photos taken at or near it
 *   Nominatim                  turning a typed area into a
 *                              point on the map, and back
 *
 * Fast first: the first look at a new area asks two free
 * services at once about the few km around you -- Photon
 * (komoot's OpenStreetMap search) and a small Overpass
 * query -- and shows whichever answers first. The app then asks for the whole neighbourhood
 * (`full`), which takes longer and is kept in KV for a
 * week, so every look after that is instant. The same area
 * is never asked about twice at once, and every request
 * names the app, as those services ask.
 */

const AGENT = 'BetweenUs/1.0 (couples app; contact via app)';
/* Public Overpass servers, the main one first; the next is tried
 * when one is slow or busy. */
const OVERPASS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const DAY = 60 * 60 * 24;

/* Each kind, as the OpenStreetMap tags that mean it. */
export const PLACE_KINDS = {
	dinner: { label: 'Dinner', emoji: '🍽️', tags: { amenity: ['restaurant'] } },
	coffee: { label: 'Coffee & sweet', emoji: '☕', tags: { amenity: ['cafe', 'ice_cream'], shop: ['bakery', 'pastry', 'confectionery'] } },
	drinks: { label: 'Drinks', emoji: '🍸', tags: { amenity: ['bar', 'pub', 'biergarten', 'nightclub'] } },
	outdoors: {
		label: 'Outdoors',
		emoji: '🌳',
		tags: {
			leisure: ['park', 'garden', 'nature_reserve', 'beach_resort', 'marina'],
			natural: ['beach'],
			tourism: ['viewpoint', 'picnic_site'],
		},
	},
	culture: { label: 'Culture', emoji: '🎨', tags: { tourism: ['museum', 'gallery', 'attraction'], amenity: ['theatre', 'arts_centre'] } },
	fun: {
		label: 'Fun',
		emoji: '🎳',
		tags: {
			leisure: ['bowling_alley', 'amusement_arcade', 'escape_game', 'miniature_golf', 'water_park', 'trampoline_park', 'ice_rink'],
			tourism: ['theme_park', 'zoo', 'aquarium'],
			amenity: ['karaoke_box', 'casino'],
		},
	},
	movies: { label: 'Cinema', emoji: '🎬', tags: { amenity: ['cinema'] } },
};

/* One line per tag key, so the query stays light. */
function filterLines(kinds, around) {
	const byKey = {};

	for (const kind of kinds) {
		for (const [key, values] of Object.entries(PLACE_KINDS[kind].tags)) {
			byKey[key] = [...new Set([...(byKey[key] || []), ...values])];
		}
	}

	return Object.entries(byKey).map(([key, values]) => `  nwr["${key}"~"^(${values.join('|')})$"]["name"](${around});`);
}

/*
 * Asks the main server; if it has not answered in a few
 * seconds the next one is asked too, and the first good
 * answer wins (the others are called off). A server that
 * refuses straight away hands over at once.
 */
const HEDGE_MS = 6000;

function overpass(body, timeoutMs = 45000) {
	return new Promise((resolve, reject) => {
		const calls = [];
		let next = 0;
		let failed = 0;
		let settled = false;
		let timer = null;

		const finish = () => {
			settled = true;
			clearTimeout(timer);
			for (const call of calls) call.abort();
		};

		const start = () => {
			if (settled || next >= OVERPASS.length) return;

			const server = OVERPASS[next++];
			const call = new AbortController();
			const stop = setTimeout(() => call.abort(), timeoutMs);

			calls.push(call);
			clearTimeout(timer);
			timer = setTimeout(start, HEDGE_MS);

			fetch(server, {
				method: 'POST',
				headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
				body: `data=${encodeURIComponent(body)}`,
				signal: call.signal,
			})
				.then(async (response) => {
					if (!response.ok) throw new Error(`overpass ${response.status}`);

					const data = await response.json();

					if (!Array.isArray(data.elements)) throw new Error('overpass: no elements');

					if (!settled) {
						finish();
						resolve(data);
					}
				})
				.catch(() => {
					failed += 1;

					if (settled) return;

					if (failed >= OVERPASS.length) {
						finish();
						reject(new Error('The map service is busy. Try again in a moment.'));
					} else {
						start();
					}
				})
				.finally(() => clearTimeout(stop));
		};

		start();
	});
}

/* One look per area at a time, however many ask for it. */
const inflight = new Map();

function once(key, make) {
	if (!inflight.has(key)) {
		inflight.set(
			key,
			make().finally(() => inflight.delete(key)),
		);
	}

	return inflight.get(key);
}

function kindOf(tags) {
	const a = tags.amenity;
	const l = tags.leisure;
	const t = tags.tourism;

	if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') return 'dinner';
	if (a === 'cafe' || a === 'ice_cream' || ['bakery', 'pastry', 'confectionery'].includes(tags.shop)) return 'coffee';
	if (['bar', 'pub', 'biergarten', 'nightclub'].includes(a)) return 'drinks';
	if (a === 'cinema') return 'movies';
	if (['museum', 'gallery', 'attraction'].includes(t) || ['theatre', 'arts_centre'].includes(a)) return 'culture';
	if (
		['park', 'garden', 'nature_reserve', 'beach_resort', 'marina'].includes(l) ||
		tags.natural === 'beach' ||
		['viewpoint', 'picnic_site'].includes(t)
	)
		return 'outdoors';
	return 'fun';
}

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

export function distanceM(lat1, lon1, lat2, lon2) {
	const r = 6371000;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}

async function cached(env, key, ttl, make) {
	try {
		const hit = await env.MEDIA.get(key, 'json');
		if (hit) return hit;
	} catch {
		/* fall through to a fresh fetch */
	}

	const value = await make();

	if (value) {
		try {
			await env.MEDIA.put(key, JSON.stringify(value), { expirationTtl: ttl });
		} catch {
			/* still return it */
		}
	}

	return value;
}

function commonsFile(name) {
	const file = String(name)
		.replace(/^File:/i, '')
		.trim();
	return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800` : null;
}

function addressOf(tags) {
	const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
	return [street, tags['addr:suburb'] || tags['addr:district'], tags['addr:city']].filter(Boolean).join(', ') || null;
}

function placeFrom(element, lat, lon) {
	const tags = element.tags || {};
	const pLat = element.lat ?? element.center?.lat;
	const pLon = element.lon ?? element.center?.lon;

	if (!tags.name || pLat === undefined) return null;

	let image = null;
	if (tags.image && /^https:\/\//.test(tags.image)) image = tags.image;
	else if (tags.wikimedia_commons && /^File:/i.test(tags.wikimedia_commons)) image = commonsFile(tags.wikimedia_commons);

	const kind = kindOf(tags);
	const richness = [
		'opening_hours',
		'website',
		'phone',
		'cuisine',
		'addr:street',
		'image',
		'wikidata',
		'contact:website',
		'contact:phone',
	].filter((key) => tags[key]).length;

	return {
		id: `${element.type}/${element.id}`,
		name: tags.name,
		kind,
		emoji: PLACE_KINDS[kind].emoji,
		lat: round(pLat, 6),
		lon: round(pLon, 6),
		distance_m: distanceM(lat, lon, pLat, pLon),
		address: addressOf(tags),
		hours: tags.opening_hours || null,
		website: tags.website || tags['contact:website'] || null,
		phone: tags.phone || tags['contact:phone'] || null,
		cuisine: tags.cuisine
			? tags.cuisine
					.split(';')
					.map((c) => c.replace(/_/g, ' '))
					.slice(0, 3)
			: [],
		wikidata: tags.wikidata || null,
		image,
		richness,
	};
}

/* P18 -- the main image -- for places that link to Wikidata. */
async function wikidataImages(ids) {
	if (ids.length === 0) return {};

	const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${ids.slice(0, 45).join('|')}`;
	const response = await fetch(url, { headers: { 'User-Agent': AGENT } });

	if (!response.ok) return {};

	const data = await response.json();
	const out = {};

	for (const [id, entity] of Object.entries(data.entities || {})) {
		const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
		if (file) out[id] = commonsFile(file);
	}

	return out;
}

/*
 * Geoapify, when a free key is set (GEOAPIFY_KEY): the same
 * OpenStreetMap places, answered in well under a second.
 */
const GEOAPIFY_KIND = [
	['catering.restaurant', 'dinner'],
	['catering.fast_food', 'dinner'],
	['catering.cafe', 'coffee'],
	['catering.ice_cream', 'coffee'],
	['commercial.food_and_drink.bakery', 'coffee'],
	['catering.bar', 'drinks'],
	['catering.pub', 'drinks'],
	['adult.nightclub', 'drinks'],
	['entertainment.cinema', 'movies'],
	['entertainment.museum', 'culture'],
	['entertainment.culture', 'culture'],
	['tourism.attraction', 'culture'],
	['leisure.park', 'outdoors'],
	['beach', 'outdoors'],
	['natural', 'outdoors'],
	['tourism.sights.viewpoint', 'outdoors'],
	['entertainment', 'fun'],
];

async function geoapifyArea(env, lat, lon) {
	const categories = [
		'catering.restaurant',
		'catering.cafe',
		'catering.ice_cream',
		'catering.bar',
		'catering.pub',
		'commercial.food_and_drink.bakery',
		'entertainment',
		'leisure.park',
		'beach',
		'tourism.attraction',
		'tourism.sights.viewpoint',
	].join(',');

	const url =
		`https://api.geoapify.com/v2/places?categories=${categories}` +
		`&filter=circle:${lon},${lat},6000&bias=proximity:${lon},${lat}&limit=300&apiKey=${env.GEOAPIFY_KEY}`;

	const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

	if (!response.ok) throw new Error('The map service is busy. Try again in a moment.');

	const data = await response.json();

	return (data.features || [])
		.map((feature) => {
			const p = feature.properties || {};
			const raw = p.datasource?.raw || {};
			const kind =
				GEOAPIFY_KIND.find(([prefix]) => (p.categories || []).some((c) => c === prefix || c.startsWith(`${prefix}.`)))?.[1] || kindOf(raw);

			if (!p.name) return null;

			return {
				id:
					raw.osm_type && raw.osm_id ? `${{ n: 'node', w: 'way', r: 'relation' }[raw.osm_type] || raw.osm_type}/${raw.osm_id}` : p.place_id,
				name: p.name,
				kind,
				emoji: PLACE_KINDS[kind].emoji,
				lat: round(p.lat, 6),
				lon: round(p.lon, 6),
				address: p.address_line2 || p.formatted || null,
				hours: p.opening_hours || raw.opening_hours || null,
				website: p.website || raw.website || null,
				phone: p.contact?.phone || raw.phone || null,
				cuisine: (p.catering?.cuisine || raw.cuisine || '')
					.split(';')
					.filter(Boolean)
					.map((c) => c.replace(/_/g, ' '))
					.slice(0, 3),
				wikidata: raw.wikidata || null,
				image: raw.image && /^https:\/\//.test(raw.image) ? raw.image : null,
				richness: [p.opening_hours, p.website, p.contact?.phone, raw.cuisine, raw.wikidata, raw.image].filter(Boolean).length,
			};
		})
		.filter(Boolean);
}

async function overpassArea(lat, lon, { radius = 6000, max = 400, timeout = 60 } = {}) {
	const kinds = Object.keys(PLACE_KINDS);
	const body = `[out:json][timeout:${timeout}];
(
${filterLines(kinds, `around:${radius},${lat},${lon}`).join('\n')}
);
out center tags ${max};`;

	const data = await overpass(body, (timeout - 5) * 1000);

	return (data.elements || []).map((element) => placeFrom(element, lat, lon)).filter(Boolean);
}

/* The same place listed twice (a node and a building) once. */
function dedupe(places) {
	const seen = new Set();

	return places.filter((place) => {
		const k = `${place.name.toLowerCase()}:${Math.round(place.lat * 500)}:${Math.round(place.lon * 500)}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

async function addPhotos(places, most) {
	try {
		const ids = [...new Set(places.filter((p) => !p.image && p.wikidata).map((p) => p.wikidata))];
		const images = await Promise.all(
			Array.from({ length: Math.ceil(Math.min(ids.length, most) / 45) }, (_, n) =>
				wikidataImages(ids.slice(n * 45, n * 45 + 45)).catch(() => ({})),
			),
		);
		const all = Object.assign({}, ...images);

		places.forEach((p) => {
			if (!p.image && all[p.wikidata]) p.image = all[p.wikidata];
		});
	} catch {
		/* photos are a bonus */
	}

	return places.map(({ wikidata, distance_m, ...rest }) => rest);
}

const cellOf = (lat, lon) => [round(Math.round(lat / 0.04) * 0.04, 2), round(Math.round(lon / 0.04) * 0.04, 2)];
const fullKey = (lat, lon) => {
	const [cellLat, cellLon] = cellOf(lat, lon);
	return `area-places:v2:${cellLat}:${cellLon}`;
};

/*
 * A whole neighbourhood at once, kept for a week: once it
 * is in, every filter and search is instant.
 */
function fullArea(env, lat, lon) {
	const [cellLat, cellLon] = cellOf(lat, lon);
	const key = fullKey(lat, lon);

	return once(key, () =>
		cached(env, key, DAY * 7, async () => {
			let places = env.GEOAPIFY_KEY ? await geoapifyArea(env, cellLat, cellLon).catch(() => null) : null;

			if (!places) places = await overpassArea(cellLat, cellLon);

			return { places: await addPhotos(dedupe(places), 135) };
		}),
	);
}

/*
 * Photon: the same OpenStreetMap places, nearest first. It
 * knows names, kinds and addresses, not opening hours; the
 * full look fills those in later.
 */
const PHOTON = 'https://photon.komoot.io/reverse';

const PHOTON_TAGS = {
	dinner: ['amenity:restaurant'],
	coffee: ['amenity:cafe', 'amenity:ice_cream', 'shop:bakery'],
	drinks: ['amenity:bar', 'amenity:pub', 'amenity:nightclub'],
	outdoors: ['leisure:park', 'leisure:garden', 'tourism:viewpoint', 'natural:beach'],
	culture: ['tourism:museum', 'tourism:gallery', 'amenity:theatre', 'amenity:arts_centre'],
	fun: ['leisure:bowling_alley', 'leisure:amusement_arcade', 'leisure:escape_game', 'tourism:zoo', 'tourism:theme_park', 'tourism:aquarium'],
	movies: ['amenity:cinema'],
};

const OSM_TYPE = { N: 'node', W: 'way', R: 'relation' };

async function photonArea(lat, lon) {
	const lists = await Promise.all(
		Object.entries(PHOTON_TAGS).map(async ([kind, tags]) => {
			try {
				const response = await fetch(
					`${PHOTON}?lat=${lat}&lon=${lon}&radius=3&limit=50&${tags.map((tag) => `osm_tag=${encodeURIComponent(tag)}`).join('&')}`,
					{ headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(20000) },
				);

				if (!response.ok) return null;

				const data = await response.json();

				return (data.features || [])
					.map((feature) => {
						const p = feature.properties || {};
						const [pLon, pLat] = feature.geometry?.coordinates || [];

						if (!p.name || pLat === undefined) return null;

						const street = [p.housenumber, p.street].filter(Boolean).join(' ');

						return {
							id: `${OSM_TYPE[p.osm_type] || 'node'}/${p.osm_id}`,
							name: p.name,
							kind,
							emoji: PLACE_KINDS[kind].emoji,
							lat: round(pLat, 6),
							lon: round(pLon, 6),
							address: [street, p.district || p.locality, p.city].filter(Boolean).join(', ') || null,
							hours: null,
							website: null,
							phone: null,
							cuisine: [],
							image: null,
							richness: street ? 1 : 0,
						};
					})
					.filter(Boolean);
			} catch {
				return null;
			}
		}),
	);

	/* Every kind failing means Photon is down; let Overpass win. */
	if (lists.every((list) => list === null)) throw new Error('photon is busy');

	const places = lists.flat().filter(Boolean);

	if (places.length === 0) throw new Error('photon found nothing');

	return places;
}

/*
 * Both services at once. A good answer from either (Overpass,
 * or 30+ places from Photon) is used straight away. A thin
 * one waits up to 12 s for the other, and the two are merged.
 */
const ENOUGH = 30;
const THIN_WAIT_MS = 12000;

function quickLook(lat, lon) {
	return new Promise((resolve, reject) => {
		let photon = null;
		let over = null;
		let done = false;
		const started = Date.now();

		const merged = () => {
			const seen = new Set();
			return [...(over || []), ...(photon || [])].filter((place) => {
				if (seen.has(place.id)) return false;
				seen.add(place.id);
				return true;
			});
		};

		const check = () => {
			if (done) return;

			const settled = photon !== null && over !== null;
			const good = over?.length > 0 || photon?.length >= ENOUGH;
			const some = merged().length > 0;

			if (good || (some && (settled || Date.now() - started >= THIN_WAIT_MS))) {
				done = true;
				resolve(merged());
			} else if (settled) {
				done = true;
				reject(new Error('The map service is busy. Try again in a moment.'));
			}
		};

		photonArea(lat, lon)
			.then((list) => (photon = list))
			.catch(() => (photon = []))
			.finally(check);

		overpassArea(lat, lon, { radius: 2500, max: 180, timeout: 40 })
			.then((list) => (over = list))
			.catch(() => (over = []))
			.finally(check);

		setTimeout(check, THIN_WAIT_MS);
	});
}

/* Just around you, for the first look at a new area. */
function quickArea(env, lat, lon) {
	const qLat = round(lat, 2);
	const qLon = round(lon, 2);
	const key = `near-places:v1:${qLat}:${qLon}`;

	return once(key, () =>
		cached(env, key, DAY * 7, async () => {
			const places = await quickLook(qLat, qLon);

			return { places: await addPhotos(dedupe(places), 45) };
		}),
	);
}

/* What is already known about here, without asking anyone. */
async function known(env, key) {
	try {
		return await env.MEDIA.get(key, 'json');
	} catch {
		return null;
	}
}

/*
 * `full`: wait for the whole neighbourhood (the app asks
 * for this itself, quietly, after a quick first look).
 * `all`: every place there, for the app to filter itself.
 */
export async function nearbyPlaces(env, { lat, lon, kind, q, radius, full, all: everything }) {
	const r = Math.min(10000, Math.max(800, radius || 6000));

	let source = await known(env, fullKey(lat, lon));
	let partial = false;

	if (!source && full) source = await fullArea(env, lat, lon);

	if (!source) {
		source = await quickArea(env, lat, lon);
		partial = true;
	}

	let places = (source.places || []).map((p) => ({ ...p, distance_m: distanceM(lat, lon, p.lat, p.lon) })).filter((p) => p.distance_m <= r);

	if (kind && PLACE_KINDS[kind]) places = places.filter((p) => p.kind === kind);

	if (q) {
		const needle = q.toLowerCase().trim();
		places = places.filter(
			(p) =>
				p.name.toLowerCase().includes(needle) ||
				p.cuisine.some((c) => c.toLowerCase().includes(needle)) ||
				PLACE_KINDS[p.kind].label.toLowerCase().includes(needle),
		);
	}

	/* Close, and well described, first. */
	places.sort((a, b) => a.distance_m / (1 + (a.richness || 0) * 0.35) - b.distance_m / (1 + (b.richness || 0) * 0.35));

	return { places: places.slice(0, everything ? 400 : 60).map(({ richness, ...rest }) => rest), partial };
}

/* Photos taken at, or right beside, a place. */
export async function placePhotos(env, { lat, lon, image }) {
	const key = `photos:v1:${round(lat, 4)}:${round(lon, 4)}`;

	return cached(env, key, DAY * 7, async () => {
		const url =
			'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch' +
			`&ggscoord=${lat}|${lon}&ggsradius=150&ggslimit=12&ggsnamespace=6` +
			'&prop=imageinfo&iiprop=url|mime&iiurlwidth=900';

		const response = await fetch(url, { headers: { 'User-Agent': AGENT } });
		const photos = image ? [image] : [];

		if (response.ok) {
			const data = await response.json();

			for (const page of Object.values(data?.query?.pages || {})) {
				const info = page.imageinfo?.[0];
				if (info?.thumburl && /^image\/(jpeg|png|webp)$/.test(info.mime || '')) photos.push(info.thumburl);
			}
		}

		return { photos: [...new Set(photos)].slice(0, 10) };
	});
}

/*
 * A typed area, looked for around where you are first (a
 * box about 150 km across); only if nothing there matches
 * is the rest of the world searched.
 */
export async function geocode(env, q, near) {
	const box = near ? `${round(near.lon - 1.4, 2)},${round(near.lat + 1.4, 2)},${round(near.lon + 1.4, 2)},${round(near.lat - 1.4, 2)}` : '';
	const key = `geo:v2:${box}:${q.toLowerCase().slice(0, 60)}`;

	const search = async (bounded) => {
		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}` +
				(bounded ? `&viewbox=${box}&bounded=1` : ''),
			{ headers: { 'User-Agent': AGENT } },
		);

		return response.ok ? response.json() : [];
	};

	return cached(env, key, DAY * 30, async () => {
		let rows = box ? await search(true) : [];

		if (!rows.length) rows = await search(false);

		return {
			results: rows.map((row) => ({
				name: row.display_name.split(',').slice(0, 3).join(','),
				lat: Number(row.lat),
				lon: Number(row.lon),
			})),
		};
	});
}

export async function areaName(env, lat, lon) {
	const key = `area:v1:${round(lat, 2)}:${round(lon, 2)}`;

	return cached(env, key, DAY * 30, async () => {
		const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=${lat}&lon=${lon}`, {
			headers: { 'User-Agent': AGENT },
		});

		if (!response.ok) return { name: null };

		const data = await response.json();
		const a = data.address || {};

		return { name: a.suburb || a.neighbourhood || a.town || a.city_district || a.city || a.county || null };
	});
}
