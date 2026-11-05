/*
 * ==========================================
 * DUELS
 * ==========================================
 *
 * The two head-to-head games. Every rule lives here, on the
 * server, so both phones always agree on what happened.
 *
 *   paintball   Standoff. Each round both of you secretly pick
 *               where to hide and where to fire, then both
 *               shots land at once. Three lives each. You can't
 *               hide in the same spot twice running, and once a
 *               match you get a paint grenade (splashes the
 *               spots either side) and a shield (stops one hit).
 *
 *   tanks       Tank Duel. Take turns: set the angle and the
 *               power, mind the wind, and lob a shell over the
 *               hills. Closer hits hurt more. First to 0 loses.
 */

export const DUEL_KINDS = ['paintball', 'tanks'];

/* ---------- PAINTBALL ---------- */

export const COVER = ['Crates', 'Bunker', 'Tree', 'Wall', 'Barrel'];
const LIVES = 3;

export function newPaintball() {
	return {
		round: 1,
		lives: { a: LIVES, b: LIVES },
		gear: { a: { grenade: 1, shield: 1 }, b: { grenade: 1, shield: 1 } },
		lastHide: { a: null, b: null },
		pending: { a: null, b: null },
		history: [],
	};
}

const validSpot = (value) => Number.isInteger(value) && value >= 0 && value < COVER.length;

/* Returns { state, error, resolved, over, winner } */
export function paintballMove(state, side, move) {
	const hide = Number(move?.hide);
	const shoot = Number(move?.shoot);
	const gear = move?.gear === 'grenade' || move?.gear === 'shield' ? move.gear : null;

	if (!validSpot(hide) || !validSpot(shoot)) return { error: 'Pick where to hide and where to fire.' };
	if (state.pending[side]) return { error: 'You have already locked in this round.' };
	if (state.lastHide[side] === hide) return { error: `You hid behind the ${COVER[hide]} last round. Move!` };
	if (gear && !(state.gear[side][gear] > 0)) return { error: `No ${gear} left.` };

	const next = structuredClone(state);
	next.pending[side] = { hide, shoot, gear };

	if (!next.pending.a || !next.pending.b) return { state: next, resolved: false };

	/* Both locked in: fire. */
	const a = next.pending.a;
	const b = next.pending.b;

	const reaches = (shot) => (shot.gear === 'grenade' ? [shot.shoot - 1, shot.shoot, shot.shoot + 1] : [shot.shoot]);

	const hitB = reaches(a).includes(b.hide);
	const hitA = reaches(b).includes(a.hide);
	const blockedA = hitA && a.gear === 'shield';
	const blockedB = hitB && b.gear === 'shield';

	if (hitA && !blockedA) next.lives.a -= 1;
	if (hitB && !blockedB) next.lives.b -= 1;

	for (const [key, shot] of [
		['a', a],
		['b', b],
	]) {
		if (shot.gear) next.gear[key][shot.gear] -= 1;
		next.lastHide[key] = shot.hide;
	}

	next.history.push({
		round: next.round,
		a,
		b,
		hit: { a: hitA && !blockedA, b: hitB && !blockedB },
		blocked: { a: blockedA, b: blockedB },
	});

	next.pending = { a: null, b: null };
	next.round += 1;

	const aOut = next.lives.a <= 0;
	const bOut = next.lives.b <= 0;
	const over = aOut || bOut;

	return {
		state: next,
		resolved: true,
		over,
		winner: over ? (aOut && bOut ? null : aOut ? 'b' : 'a') : null,
	};
}

export function paintballView(state, side) {
	const other = side === 'a' ? 'b' : 'a';
	const flip = (entry) =>
		entry && {
			round: entry.round,
			you: entry[side],
			them: entry[other],
			hit: { you: entry.hit[side], them: entry.hit[other] },
			blocked: { you: entry.blocked[side], them: entry.blocked[other] },
		};

	return {
		cover: COVER,
		round: state.round,
		lives: { you: state.lives[side], them: state.lives[other] },
		gear: { you: state.gear[side], them: state.gear[other] },
		last_hide: state.lastHide[side],
		your_pick: state.pending[side],
		you_locked: Boolean(state.pending[side]),
		them_locked: Boolean(state.pending[other]),
		history: state.history.map(flip),
	};
}

/* ---------- TANKS ---------- */

const WIDTH = 1000;
const STEP = 10;
const GRAVITY = 50;
const TANK_X = { a: 110, b: 890 };
const HP = 100;
const MAX_TURNS = 40;

/* Small, seedable, the same on every run. */
function random(seed) {
	let t = seed >>> 0;

	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export function terrainFor(seed) {
	const rand = random(seed);
	const waves = [0, 1, 2].map(() => ({
		amp: 25 + rand() * 45,
		freq: 1 + rand() * 3,
		phase: rand() * Math.PI * 2,
	}));

	const heights = [];

	for (let x = 0; x <= WIDTH; x += STEP) {
		const t = x / WIDTH;
		let y = 120;
		for (const w of waves) y += w.amp * Math.sin(t * Math.PI * w.freq + w.phase);
		/* A hill in the middle, so it is never a flat shot. */
		y += 110 * Math.exp(-(((t - 0.5) / 0.16) ** 2));
		heights.push(Math.max(40, Math.round(y)));
	}

	/* Flatten under each tank. */
	for (const key of ['a', 'b']) {
		const i = Math.round(TANK_X[key] / STEP);
		const level = heights[i];
		for (let j = i - 3; j <= i + 3; j++) if (heights[j] !== undefined) heights[j] = level;
	}

	return heights;
}

function groundAt(heights, x) {
	const i = Math.max(0, Math.min(heights.length - 2, Math.floor(x / STEP)));
	const f = x / STEP - i;
	return heights[i] * (1 - f) + heights[i + 1] * f;
}

function windFor(seed, turn) {
	const rand = random(seed + turn * 7919);
	return Math.round((rand() * 2 - 1) * 10) / 10;
}

export function newTanks() {
	const seed = Math.floor(Math.random() * 1e9);

	return {
		seed,
		turnNumber: 1,
		hp: { a: HP, b: HP },
		wind: windFor(seed, 1),
		last: null,
	};
}

export function simulate(heights, from, angle, power, wind) {
	const dir = from === 'a' ? 1 : -1;
	const speed = power * 3;
	const rad = (angle * Math.PI) / 180;
	let x = TANK_X[from] + dir * 14;
	let y = groundAt(heights, TANK_X[from]) + 16;
	let vx = Math.cos(rad) * speed * dir;
	let vy = Math.sin(rad) * speed;
	const dt = 0.02;
	const path = [[Math.round(x), Math.round(y)]];
	const enemy = from === 'a' ? 'b' : 'a';

	for (let i = 0; i < 1500; i++) {
		vx += wind * 6 * dt;
		vy -= GRAVITY * dt;
		x += vx * dt;
		y += vy * dt;

		if (i % 4 === 0) path.push([Math.round(x), Math.round(y)]);

		const tankY = groundAt(heights, TANK_X[enemy]) + 8;
		if (Math.hypot(x - TANK_X[enemy], y - tankY) < 16) {
			path.push([Math.round(x), Math.round(y)]);
			return { path, impact: [Math.round(x), Math.round(y)], direct: true };
		}

		if (x < -40 || x > WIDTH + 40) return { path, impact: null, direct: false };

		if (y <= groundAt(heights, x)) {
			const gy = groundAt(heights, x);
			path.push([Math.round(x), Math.round(gy)]);
			return { path, impact: [Math.round(x), Math.round(gy)], direct: false };
		}
	}

	return { path, impact: null, direct: false };
}

function damageAt(heights, impact, key) {
	if (!impact) return 0;

	const d = Math.hypot(impact[0] - TANK_X[key], impact[1] - (groundAt(heights, TANK_X[key]) + 8));

	if (d < 16) return 40;
	if (d < 75) return Math.round(32 * (1 - d / 75));
	return 0;
}

export function tanksMove(state, side, move) {
	const angle = Number(move?.angle);
	const power = Number(move?.power);

	if (!(angle >= 5 && angle <= 85) || !(power >= 10 && power <= 100)) {
		return { error: 'Set an angle (5–85) and power (10–100).' };
	}

	const heights = terrainFor(state.seed);
	const shot = simulate(heights, side, angle, power, state.wind);
	const enemy = side === 'a' ? 'b' : 'a';

	const next = structuredClone(state);
	const toEnemy = damageAt(heights, shot.impact, enemy);
	const toSelf = damageAt(heights, shot.impact, side);

	next.hp[enemy] = Math.max(0, next.hp[enemy] - toEnemy);
	next.hp[side] = Math.max(0, next.hp[side] - Math.round(toSelf / 2));

	next.last = {
		by: side,
		angle,
		power,
		wind: state.wind,
		path: shot.path,
		impact: shot.impact,
		direct: shot.direct,
		damage: toEnemy,
		self: Math.round(toSelf / 2),
		turn: state.turnNumber,
	};

	next.turnNumber += 1;
	next.wind = windFor(state.seed, next.turnNumber);

	const aOut = next.hp.a <= 0;
	const bOut = next.hp.b <= 0;
	let over = aOut || bOut;
	let winner = over ? (aOut && bOut ? null : aOut ? 'b' : 'a') : null;

	if (!over && next.turnNumber > MAX_TURNS) {
		over = true;
		winner = next.hp.a === next.hp.b ? null : next.hp.a > next.hp.b ? 'a' : 'b';
	}

	return { state: next, over, winner };
}

export function tanksView(state, side) {
	const other = side === 'a' ? 'b' : 'a';
	const heights = terrainFor(state.seed);
	const last = state.last;

	return {
		width: WIDTH,
		terrain: heights,
		step: STEP,
		tank: {
			you: { x: TANK_X[side], y: Math.round(groundAt(heights, TANK_X[side])), facing: side === 'a' ? 1 : -1 },
			them: { x: TANK_X[other], y: Math.round(groundAt(heights, TANK_X[other])), facing: other === 'a' ? 1 : -1 },
		},
		hp: { you: state.hp[side], them: state.hp[other], max: HP },
		wind: state.wind,
		turn_number: state.turnNumber,
		max_turns: MAX_TURNS,
		last: last && {
			by: last.by === side ? 'you' : 'them',
			angle: last.angle,
			power: last.power,
			wind: last.wind,
			path: last.path,
			impact: last.impact,
			direct: last.direct,
			damage: last.damage,
			self: last.self,
			turn: last.turn,
		},
	};
}
