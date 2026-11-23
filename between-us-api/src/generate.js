/*
 * ==========================================
 * QUESTIONS THAT KEEP COMING
 * ==========================================
 *
 * The games write their own questions. Workers AI (free on
 * Cloudflare's free plan, within a daily allowance; past it
 * a call simply fails, nothing is billed) writes a batch
 * whenever a game is running low on ones this couple has
 * not seen. Each batch is checked for shape, stripped of
 * repeats, and kept in question_bank, so every couple draws
 * on everything written so far.
 *
 *   this_or_that   { a, b }                 "Hugs" or "Kisses"
 *   likely         { text }                 who's more likely to …
 *   about          { self, them, options }  trivia about each other
 *
 * The hand-written lists (play.js, about.js) are only a
 * safety net now, for when the AI is unavailable.
 */

const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-4-scout-17b-16e-instruct'];

const TONE =
	'The players are a couple, often young, many in Nigeria. Keep it warm, playful and a little flirty at most (never explicit), ' +
	'easy to read on a phone, and understandable anywhere; an occasional West African touch (jollof, Afrobeats, owambe) is welcome but not every time.';

const norm = (text) =>
	String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const short = (text, most) => {
	const value = String(text || '')
		.replace(/\s+/g, ' ')
		.trim();
	return value.length >= 2 && value.length <= most ? value : null;
};

const KINDS = {
	this_or_that: {
		batch: 24,
		ask: (n, avoid) =>
			`Write ${n} new "This or That" choices for a couples game: two short options each (1 to 4 words), ` +
			`about habits, food, dates, affection, lifestyle, travel and silly hypotheticals. Mix light and fun. ` +
			`Do not repeat any of these: ${avoid}.`,
		schema: { a: 'string', b: 'string' },
		clean: (item) => {
			const a = short(item?.a, 40);
			const b = short(item?.b, 40);
			if (!a || !b || norm(a) === norm(b)) return null;
			return { a, b };
		},
		key: (item) => norm(`${item.a} ${item.b}`),
		label: (item) => `${item.a} / ${item.b}`,
	},

	likely: {
		batch: 24,
		ask: (n, avoid) =>
			`Write ${n} new endings for "Who's more likely to ...?" for a couples game. Each is a short lowercase phrase ` +
			`(3 to 9 words) that completes the sentence, with no question mark, e.g. "fall asleep first on a film night". ` +
			`Funny, sweet and relatable. Do not repeat any of these: ${avoid}.`,
		schema: { text: 'string' },
		clean: (item) => {
			let text = String(item?.text || '')
				.replace(/^\s*who('|’)?s\s+more\s+likely\s+to\s+/i, '')
				.replace(/[?.!]+\s*$/, '')
				.trim();
			text = text.charAt(0).toLowerCase() + text.slice(1);
			text = short(text, 80);
			if (!text || text.split(' ').length < 2) return null;
			return { text };
		},
		key: (item) => norm(item.text),
		label: (item) => item.text,
	},

	about: {
		batch: 14,
		ask: (n, avoid) =>
			`Write ${n} new multiple-choice questions for a couples trivia game. Each person first answers about themselves, ` +
			`then their partner guesses. For each give: "self" (asked to the person, e.g. "Your ideal Sunday?"), ` +
			`"them" (the same question about the partner, using {name} for their name, e.g. "{name}'s ideal Sunday?") and ` +
			`"options": exactly 4 short distinct answers (1 to 5 words). Topics: habits, tastes, dreams, love, quirks, memories. ` +
			`Do not repeat any of these: ${avoid}.`,
		schema: { self: 'string', them: 'string', options: 'array' },
		clean: (item) => {
			const self = short(item?.self, 90);
			let them = short(item?.them, 90);
			if (them && !them.includes('{name}')) them = them.replace(/\b(your partner|your person|them|they)\b/i, '{name}');
			const options = Array.isArray(item?.options) ? [...new Set(item.options.map((o) => short(o, 40)).filter(Boolean))] : [];
			if (!self || !them || !them.includes('{name}') || options.length !== 4) return null;
			return { self, them, options };
		},
		key: (item) => norm(item.self),
		label: (item) => item.self,
	},
};

function jsonSchema(kind) {
	const fields = KINDS[kind].schema;
	const properties = {};

	for (const [name, type] of Object.entries(fields)) {
		properties[name] = type === 'array' ? { type: 'array', items: { type: 'string' } } : { type: 'string' };
	}

	return {
		type: 'object',
		properties: { items: { type: 'array', items: { type: 'object', properties, required: Object.keys(fields) } } },
		required: ['items'],
	};
}

/* The model's answer as a list, whatever shape it came back in. */
function itemsFrom(result) {
	let value = result?.response ?? result;

	if (typeof value === 'string') {
		const start = value.search(/[[{]/);
		if (start < 0) return [];
		try {
			value = JSON.parse(value.slice(start, Math.max(value.lastIndexOf('}'), value.lastIndexOf(']')) + 1));
		} catch {
			return [];
		}
	}

	if (Array.isArray(value)) return value;
	if (Array.isArray(value?.items)) return value.items;
	return [];
}

export async function write(env, kind, avoid) {
	const spec = KINDS[kind];
	const messages = [
		{ role: 'system', content: `You write content for a couples app called Between Us. ${TONE} Reply with JSON only.` },
		{ role: 'user', content: `${spec.ask(spec.batch, avoid)}\nReply as {"items": [...]}.` },
	];

	for (const model of MODELS) {
		try {
			const result = await env.AI.run(model, {
				messages,
				max_tokens: 1800,
				temperature: 0.95,
				response_format: { type: 'json_schema', json_schema: jsonSchema(kind) },
			});
			const items = itemsFrom(result).map(spec.clean).filter(Boolean);
			if (items.length >= 3) return items;
		} catch (err) {
			console.error(`QUESTIONS: ${model} failed for ${kind}:`, err?.message);
		}
	}

	return [];
}

/* Everything written so far for a game, as { id, ...item }. */
export async function bankOf(sql, kind) {
	try {
		const rows = await sql`SELECT id, payload FROM question_bank WHERE kind = ${kind} ORDER BY created_at DESC LIMIT 2000`;
		return rows.map((row) => ({ id: row.id, ...row.payload }));
	} catch {
		return [];
	}
}

/* A batch at a time, one per game per isolate however many ask. */
const writing = new Map();

export function topUp(env, sql, kind, known = []) {
	if (!env.AI || !KINDS[kind]) return Promise.resolve(0);
	if (writing.has(kind)) return writing.get(kind);

	const spec = KINDS[kind];

	const job = (async () => {
		/* A sample of what exists, so the batch is new. */
		const sample = [...known]
			.sort(() => Math.random() - 0.5)
			.slice(0, 50)
			.map((item) => `"${spec.label(item)}"`)
			.join(', ');

		const items = await write(env, kind, sample || 'none yet');
		const seen = new Set(known.map(spec.key));
		const fresh = items.filter((item) => {
			const k = spec.key(item);
			if (!k || seen.has(k)) return false;
			seen.add(k);
			return true;
		});

		if (!fresh.length) return 0;

		const rows = fresh.map((item) => ({
			id: `g_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
			norm: spec.key(item),
			payload: item,
		}));

		await sql`
			INSERT INTO question_bank (id, kind, norm, payload)
			SELECT r->>'id', ${kind}, r->>'norm', r->'payload'
			FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS r
			ON CONFLICT DO NOTHING
		`;

		console.log(`QUESTIONS: wrote ${fresh.length} new ${kind}`);
		return fresh.length;
	})()
		.catch((err) => {
			console.error(`QUESTIONS: top-up failed for ${kind}:`, err?.message);
			return 0;
		})
		.finally(() => writing.delete(kind));

	writing.set(kind, job);
	return job;
}

/* Waits for a batch, but never longer than `ms`. */
export function topUpWithin(env, sql, kind, known, ms) {
	return Promise.race([topUp(env, sql, kind, known), new Promise((resolve) => setTimeout(() => resolve(0), ms))]);
}

export const GENERATED_KINDS = Object.keys(KINDS);
