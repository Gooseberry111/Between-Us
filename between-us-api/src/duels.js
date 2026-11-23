/*
 * ==========================================
 * DUELS
 * ==========================================
 *
 * The two head-to-head games. Every rule lives here, on the
 * server, so both phones always agree on what happened.
 *
 *   zombies     Zombie Rush. The server writes one wave of
 *               zombies; you each play it once, whenever you
 *               like, tapping them before they reach you. Three
 *               hearts, 45 seconds. Higher score wins.
 *
 *   tanks       Tank Duel. Take turns: set the angle and the
 *               power, mind the wind, and lob a shell over the
 *               hills. Closer hits hurt more. First to 0 loses.
 */

export const DUEL_KINDS = ['zombies', 'tanks'];

/* ---------- ZOMBIE RUSH ---------- */

const RUSH_MS = 45000;
const HEARTS = 3;

/* What each kind is: hits to drop it, points, speed (arena heights per second). */
export const ZOMBIES = {
	walker: { hp: 1, points: 10, speed: [0.15, 0.21] },
	runner: { hp: 1, points: 15, speed: [0.28, 0.36] },
	brute: { hp: 3, points: 50, speed: [0.09, 0.11] },
};

/*
 * The wave: when each zombie appears (ms), where across the
 * arena (0-1), how fast and what kind. It gets properly hard:
 * as the run goes on they come closer together (about 1 s
 * apart at first, a quarter of a second by the end), walk
 * faster (up to about 2.4 times their starting pace), more
 * of them are runners, and in the second half they start
 * arriving in pairs. A brute every ten seconds or so.
 */
function waveFor(seed) {
	const rand = random(seed);
	const wave = [];
	let t = 900;
	let nextBrute = 9000;

	const add = (time, kind, progress) => {
		const [slow, fast] = ZOMBIES[kind].speed;
		const pace = 1 + progress * 1.4;

		wave.push({
			id: wave.length,
			t: Math.round(time),
			x: Math.round((0.08 + rand() * 0.84) * 1000) / 1000,
			speed: Math.round((slow + rand() * (fast - slow)) * pace * 1000) / 1000,
			kind,
		});
	};

	while (t < RUSH_MS - 1500) {
		const progress = t / RUSH_MS;
		let kind = rand() < 0.2 + progress * 0.4 ? 'runner' : 'walker';

		if (t >= nextBrute) {
			kind = 'brute';
			nextBrute += 9000 + Math.round(rand() * 2500);
		}

		add(t, kind, progress);

		/* The second half: sometimes two at once. */
		if (progress > 0.5 && kind !== 'brute' && rand() < (progress - 0.5) * 0.9) {
			add(t + 120, rand() < 0.5 ? 'runner' : 'walker', progress);
		}

		t += Math.max(250, 1000 - progress * 800 + (rand() - 0.5) * 250);
	}

	return wave;
}

export function newZombies() {
	const seed = Math.floor(Math.random() * 1e9);

	return {
		seed,
		wave: waveFor(seed),
		scores: { a: null, b: null },
		kills: { a: null, b: null },
	};
}

/* Returns { state, error, over, winner } */
export function zombiesMove(state, side, move) {
	if (state.scores[side] !== null) return { error: 'You have had your run. Waiting on them.' };

	const score = Number(move?.score);
	const kills = Number(move?.kills);
	const most = state.wave.reduce((sum, z) => sum + ZOMBIES[z.kind].points, 0);

	if (!Number.isInteger(score) || score < 0 || score > most || score % 5 !== 0) return { error: 'That score does not add up.' };
	if (!Number.isInteger(kills) || kills < 0 || kills > state.wave.length) return { error: 'That score does not add up.' };

	const next = structuredClone(state);
	next.scores[side] = score;
	next.kills[side] = kills;

	const over = next.scores.a !== null && next.scores.b !== null;

	return {
		state: next,
		over,
		winner: over ? (next.scores.a === next.scores.b ? null : next.scores.a > next.scores.b ? 'a' : 'b') : null,
	};
}

export function zombiesView(state, side) {
	const other = side === 'a' ? 'b' : 'a';

	return {
		wave: state.wave,
		duration: RUSH_MS,
		hearts: HEARTS,
		kinds: ZOMBIES,
		played: { you: state.scores[side] !== null, them: state.scores[other] !== null },
		scores: { you: state.scores[side], them: state.scores[other] },
		kills: { you: state.kills[side], them: state.kills[other] },
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
