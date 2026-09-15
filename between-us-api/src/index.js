import { neon } from '@neondatabase/serverless';

/*
 * ==========================================
 * AUTHENTICATION
 * ==========================================
 *
 * Every request carries a Clerk session token.
 * We verify its signature against Clerk's public
 * JWKS, so identity comes from a signed token
 * rather than from whatever id the caller typed
 * into the URL.
 *
 * Before this existed, any stranger could list
 * every user and read or overwrite their data
 * using nothing but a clerk_id.
 *
 * JWKS is public, so this needs no extra secret.
 */

let jwksCache = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJwks(issuer) {
	const now = Date.now();

	if (jwksCache && now - jwksFetchedAt < JWKS_TTL_MS) {
		return jwksCache;
	}

	const response = await fetch(`${issuer}/.well-known/jwks.json`);

	if (!response.ok) {
		throw new Error('Unable to fetch signing keys');
	}

	jwksCache = await response.json();
	jwksFetchedAt = now;

	return jwksCache;
}

function base64UrlDecode(input) {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

function decodeJson(segment) {
	return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
}

/*
 * Returns the Clerk user id the token belongs to,
 * or null if it is missing, malformed, expired or
 * not actually signed by Clerk.
 */
async function verifySessionToken(request, env) {
	/* Log the reason for a rejection, never the token itself. */
	const reject = (reason, detail) => {
		console.log('AUTH REJECT:', reason, detail === undefined ? '' : detail);
		return null;
	};

	const header = request.headers.get('Authorization') || '';

	if (!header.startsWith('Bearer ')) return reject('no bearer header');

	const token = header.slice(7).trim();
	const parts = token.split('.');

	if (parts.length !== 3) return reject('malformed token', parts.length + ' parts');

	try {
		const [headerPart, payloadPart, signaturePart] = parts;
		const tokenHeader = decodeJson(headerPart);
		const payload = decodeJson(payloadPart);

		const issuer = env.CLERK_ISSUER;

		if (!issuer) return reject('CLERK_ISSUER not configured');

		/*
		 * A token from somebody else's Clerk instance
		 * must not be accepted here.
		 */
		if (payload.iss && payload.iss !== issuer) return reject('issuer mismatch', `got ${payload.iss} expected ${issuer}`);

		const now = Math.floor(Date.now() / 1000);

		/* Small tolerance so a request sent right at expiry is not bounced. */
		if (typeof payload.exp === 'number' && payload.exp + 10 < now) return reject('expired', `${now - payload.exp}s ago`);
		if (typeof payload.nbf === 'number' && payload.nbf > now + 5) return reject('not yet valid');
		if (!payload.sub) return reject('no sub claim');

		const jwks = await getJwks(issuer);
		const jwk = (jwks.keys || []).find((k) => k.kid === tokenHeader.kid);

		if (!jwk) return reject('unknown signing key', tokenHeader.kid);

		const key = await crypto.subtle.importKey(
			'jwk',
			{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify'],
		);

		const valid = await crypto.subtle.verify(
			'RSASSA-PKCS1-v1_5',
			key,
			base64UrlDecode(signaturePart),
			new TextEncoder().encode(`${headerPart}.${payloadPart}`),
		);

		return valid ? payload.sub : reject('bad signature');
	} catch (error) {
		console.log('TOKEN VERIFY ERROR:', error?.message || error);

		return null;
	}
}

/*
 * Open endpoints. Everything else needs a token.
 */
const PUBLIC_PATHS = new Set(['/', '/health']);

function unauthorized(message) {
	return Response.json({ error: message }, { status: 401 });
}

function forbidden() {
	return Response.json(
		{ error: 'You can only access your own account.' },
		{ status: 403 },
	);
}

/*
 * A real, past calendar date. The previous check only
 * looked at the YYYY-MM-DD shape, so 2003-13-45 got as
 * far as the database before being refused.
 */
const MINIMUM_AGE = 17;

function birthdayProblem(value) {
	const text = String(value || '').trim();

	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return 'Birthday must be in YYYY-MM-DD format';
	}

	const [year, month, day] = text.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));

	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		return 'That birthday is not a real date';
	}

	if (date > new Date() || year < 1900) {
		return 'That birthday is not valid';
	}

	const today = new Date();
	let age = today.getUTCFullYear() - year;
	const beforeBirthday =
		today.getUTCMonth() < month - 1 || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);

	if (beforeBirthday) age -= 1;

	if (age < MINIMUM_AGE) {
		return `You need to be at least ${MINIMUM_AGE} to use Between Us`;
	}

	return null;
}

async function sendPushNotification({ pushToken, title, body, data = {} }) {
	if (!pushToken) {
		return {
			success: false,
			error: 'No push token',
		};
	}

	try {
		const response = await fetch('https://exp.host/--/api/v2/push/send', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Accept-encoding': 'gzip, deflate',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				to: pushToken,
				sound: 'default',
				title,
				body,
				data,
			}),
		});

		const result = await response.json();

		console.log('PUSH NOTIFICATION RESULT:', result);

		return {
			success: response.ok,
			result,
		};
	} catch (error) {
		console.error('PUSH NOTIFICATION ERROR:', error);

		return {
			success: false,
			error: error?.message || 'Push notification failed',
		};
	}
}
/*
 * ==========================================
 * SCHEDULED NOTIFICATION HELPERS
 * ==========================================
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/*
 * Quote of the Day content.
 *
 * Original, unattributed lines so nothing is
 * misattributed to a real author.
 */
const QUOTES_OF_THE_DAY = [
	'Love grows in the small moments you almost forget to notice.',
	"A relationship is built one ordinary day at a time.",
	'Say the kind thing today. There will never be a better time.',
	'The best partners are the ones who make the boring days feel good.',
	'Checking in matters more than grand gestures.',
	'Choose each other again today, on purpose.',
	'Every relationship needs maintenance, not just memories.',
	'Curiosity about your partner never expires.',
	'Small kindnesses, repeated daily, are what love is made of.',
	'Today is a good day to ask how they are really doing.',
	'The strongest couples are the best at repairing, not the ones who never argue.',
	'Gratitude out loud lands differently than gratitude kept quiet.',
	'You do not need a reason to make someone feel loved today.',
	'Presence is the gift most partners actually want.',
	'A relationship is a living thing. Keep watering it.',
];

/*
 * Date Idea content.
 */
const DATE_IDEAS = [
	'Cook a new recipe together tonight, no matter how it turns out.',
	'Take a walk with no destination and no phones.',
	'Recreate your first date, wherever it was.',
	'Write each other a short list of favorite memories together, then swap.',
	'Try the restaurant you keep saying "we should go there" about.',
	'Have a no-agenda conversation about your dreams for next year.',
	'Do a puzzle or board game night, loser makes breakfast.',
	'Watch the sunset somewhere you have never watched it from.',
	'Plan a mini day trip somewhere neither of you has been.',
	'Have a picnic, even if it is just in the living room.',
	'Take turns picking a song that reminds you of the other person.',
	'Go stargazing and talk about nothing important.',
	'Try a class together, cooking, dance, or something silly.',
	'Write a letter to each other for a hard week, to open when needed.',
	'Revisit an old photo album and tell the stories behind them.',
];


/*
 * Daily question catalogue.
 *
 * One is served per day, rotating by day of year.
 * Kept here rather than in a table so there is
 * nothing to seed; answers store a slug of the
 * question so history stays readable even if this
 * list is reordered later.
 */
const DAILY_QUESTIONS = [
	'What is something I did recently that you appreciated but never said out loud?',
	'What does a perfect ordinary day together look like to you?',
	'When do you feel closest to me?',
	'What is something you are looking forward to right now?',
	'What is one thing you wish we did more often?',
	'What is a small thing that instantly improves your mood?',
	'What is something you are proud of yourself for this week?',
	'Where would you most want to wake up tomorrow?',
	'What is something about me that made you laugh recently?',
	'What is one thing you need more of from me right now?',
	'What is a memory of us you think about often?',
	'What is something you are worried about that you have not said?',
	'What is your favourite thing about our relationship right now?',
	'What is something new you would like us to try together?',
	'What does feeling loved actually look like for you?',
	'What is the hardest part of your week so far?',
	'What is something you have changed your mind about lately?',
	'What song reminds you of us?',
	'What is one thing you would like us to stop doing?',
	'What is something you find attractive about me that is not physical?',
	'What is a goal you want us to work on together?',
	'When did you last feel really understood by me?',
	'What is something you are grateful for today?',
	'What is a tradition you would like us to start?',
	'What is something you loved doing as a child?',
	'What is the best advice about love you have ever heard?',
	'What is something you want to do before the year ends?',
	'What do you need after a hard day?',
	'What is something I do that makes you feel safe?',
	'What is a place you would love us to travel to?',
	'What is something you want to get better at?',
	'What was the moment you knew you cared about me?',
	'What is something you find difficult to talk about?',
	'What does support look like to you when you are stressed?',
	'What is a compliment you received that stuck with you?',
	'What would you want our life to look like in five years?',
	'What is something small I could do this week that would mean a lot?',
	'What is your favourite thing we have done together?',
	'What is something you are curious about lately?',
	'What is a fear you have about the future?',
	'What makes you feel most like yourself?',
	'What is something you wish I understood better about you?',
	'What is the nicest thing someone has done for you?',
	'What is something you want to celebrate about us?',
	'What is one way we have grown since we started?',
];

/*
 * Tables for the newer features are created on demand.
 *
 * The migration files remain the canonical definitions,
 * but applying them needs database access this pipeline
 * does not have, so each feature makes sure its own
 * tables exist rather than failing until somebody runs
 * the SQL by hand. Everything here is idempotent and
 * purely additive, and the flag keeps it to one check
 * per isolate rather than per request.
 */
let schemaReady = false;

async function ensureSchema(sql) {
	if (schemaReady) return;

	await sql`
		CREATE TABLE IF NOT EXISTS daily_answers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			question_date DATE NOT NULL,
			question_key TEXT NOT NULL,
			answer TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`;

	/*
	 * These unique indexes are deliberately not partial,
	 * so a plain ON CONFLICT can infer them.
	 */
	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS daily_answers_user_date_idx
			ON daily_answers (user_id, question_date)
	`;

	await sql`
		CREATE INDEX IF NOT EXISTS daily_answers_connection_date_idx
			ON daily_answers (connection_id, question_date DESC)
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS appreciations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
			from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			message TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`;

	await sql`
		CREATE INDEX IF NOT EXISTS appreciations_connection_idx
			ON appreciations (connection_id, created_at DESC)
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS checkins (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			week_key TEXT NOT NULL,
			rating INTEGER NOT NULL,
			note TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`;

	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_week_idx
			ON checkins (user_id, week_key)
	`;

	await sql`
		CREATE INDEX IF NOT EXISTS checkins_connection_idx
			ON checkins (connection_id, week_key DESC)
	`;

	schemaReady = true;
}

function slugifyQuestion(text) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

/*
 * The question for a given day, rotating by day of year.
 */
function questionForDate(date) {
	const startOfYear = new Date(date.getFullYear(), 0, 0);
	const dayOfYear = Math.floor((date - startOfYear) / MS_PER_DAY);
	const text = DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];

	return { key: slugifyQuestion(text), text };
}

function toIsoDate(value) {
	if (!value) return null;

	return typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
}

/*
 * Consecutive days answered, counting back from today.
 * Answering yesterday but not yet today keeps the streak
 * alive -- it only breaks once a whole day is missed.
 */
function computeStreak(dates, todayIso) {
	const answered = new Set(dates.map(toIsoDate).filter(Boolean));

	const cursor = new Date(`${todayIso}T00:00:00Z`);

	if (!answered.has(todayIso)) {
		cursor.setUTCDate(cursor.getUTCDate() - 1);

		if (!answered.has(cursor.toISOString().slice(0, 10))) {
			return 0;
		}
	}

	let streak = 0;

	while (answered.has(cursor.toISOString().slice(0, 10))) {
		streak += 1;
		cursor.setUTCDate(cursor.getUTCDate() - 1);
	}

	return streak;
}

/*
 * Days remaining until the next annual occurrence
 * of a month/day (birthday, anniversary, special date).
 *
 * requireFirstAnniversary skips this year's date if it
 * falls before the first full year has passed.
 */
function nextAnnualOccurrence(dateStr, today, { requireFirstAnniversary = false } = {}) {
	if (!dateStr) return null;

	const base = new Date(dateStr);

	if (Number.isNaN(base.getTime())) return null;

	let next = new Date(today.getFullYear(), base.getMonth(), base.getDate());

	if (next < today) {
		next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
	}

	if (requireFirstAnniversary) {
		const firstAnniversary = new Date(base);

		firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

		if (next < firstAnniversary) {
			next = new Date(firstAnniversary);
		}
	}

	const daysUntil = Math.ceil((next - today) / MS_PER_DAY);

	return { date: next, daysUntil };
}

/*
 * ISO week key (e.g. "2026-W36").
 *
 * Used to dedupe notifications that should re-fire at
 * most once per week (inactivity, trivia nudges, date ideas)
 * rather than once ever.
 */
function isoWeekKey(date) {
	const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

	const dayNumber = target.getUTCDay() || 7;

	target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

	const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

	const weekNumber = Math.ceil(((target - yearStart) / MS_PER_DAY + 1) / 7);

	return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/*
 * Create an in-app notification and, if it was actually
 * inserted (i.e. not a duplicate for this dedupe_key), send
 * the matching push notification.
 *
 * Skips entirely if the recipient has turned this notification
 * type off. Preferences only store explicit opt-outs, so a
 * missing key means the type is enabled.
 *
 * Returns true if a new notification was created.
 */
async function notifyUser(sql, { userId, pushToken, preferences, type, title, message, dedupeKey, data = {} }) {
	if (preferences && preferences[type] === false) {
		return false;
	}

	try {
		/*
		 * The unique index backing this is partial
		 * (WHERE dedupe_key IS NOT NULL), so the same
		 * predicate has to be repeated here for Postgres
		 * to infer it. Without it, every insert fails with
		 * "no unique or exclusion constraint matching the
		 * ON CONFLICT specification".
		 */
		const inserted = await sql`
			INSERT INTO notifications (
				user_id,
				type,
				title,
				message,
				dedupe_key
			)
			VALUES (
				${userId},
				${type},
				${title},
				${message},
				${dedupeKey}
			)
			ON CONFLICT (user_id, dedupe_key)
			WHERE dedupe_key IS NOT NULL
			DO NOTHING
			RETURNING id
		`;

		if (inserted.length === 0) {
			return false;
		}

		if (pushToken) {
			await sendPushNotification({
				pushToken,
				title,
				body: message,
				data: { type, ...data },
			});
		}

		return true;
	} catch (error) {
		/*
		 * A single failed notification must never abort
		 * the rest of the scheduled run.
		 */
		console.error('NOTIFY USER ERROR:', type, error?.message || error);

		return false;
	}
}

export default {
	async scheduled(event, env, ctx) {
		console.log('BETWEEN US: Scheduled notification job started');

		const sql = neon(env.DATABASE_URL);

		const today = new Date();
		const todayIso = today.toISOString().slice(0, 10);
		const weekKey = isoWeekKey(today);

		try {
			/*
			 * ==========================================
			 * ACCEPTED CONNECTIONS
			 * ==========================================
			 *
			 * Shared base for birthday, anniversary,
			 * trivia and date idea checks.
			 */
			const connections = await sql`
				SELECT
					c.id,
					c.user_one,
					c.user_two,
					c.connected_at,
					u1.push_token AS user_one_push_token,
					u2.push_token AS user_two_push_token,
					u1.notification_preferences AS user_one_preferences,
					u2.notification_preferences AS user_two_preferences,
					p1.first_name AS user_one_first_name,
					p2.first_name AS user_two_first_name,
					p1.birthday AS user_one_birthday,
					p2.birthday AS user_two_birthday
				FROM connections c
				INNER JOIN users u1 ON u1.id = c.user_one
				INNER JOIN users u2 ON u2.id = c.user_two
				LEFT JOIN profiles p1 ON p1.user_id = u1.id
				LEFT JOIN profiles p2 ON p2.user_id = u2.id
				WHERE c.status = 'accepted'
			`;

			for (const connection of connections) {
				const members = [
					{
						userId: connection.user_one,
						pushToken: connection.user_one_push_token,
						preferences: connection.user_one_preferences,
						birthday: connection.user_one_birthday,
						firstName: connection.user_one_first_name,
						partnerId: connection.user_two,
						partnerPushToken: connection.user_two_push_token,
						partnerPreferences: connection.user_two_preferences,
						partnerFirstName: connection.user_two_first_name,
					},
					{
						userId: connection.user_two,
						pushToken: connection.user_two_push_token,
						preferences: connection.user_two_preferences,
						birthday: connection.user_two_birthday,
						firstName: connection.user_two_first_name,
						partnerId: connection.user_one,
						partnerPushToken: connection.user_one_push_token,
						partnerPreferences: connection.user_one_preferences,
						partnerFirstName: connection.user_one_first_name,
					},
				];

				/*
				 * ==========================================
				 * 1. BIRTHDAY — notify the partner
				 * ==========================================
				 */
				for (const member of members) {
					const occurrence = nextAnnualOccurrence(member.birthday, today);

					if (!occurrence || occurrence.daysUntil > 30) continue;

					const ownerName = member.firstName?.trim() || 'Your partner';

					await notifyUser(sql, {
						userId: member.partnerId,
						pushToken: member.partnerPushToken,
						preferences: member.partnerPreferences,
						type: 'birthday',
						title: `${ownerName}'s birthday is coming up`,
						message:
							occurrence.daysUntil === 0
								? `Today is ${ownerName}'s birthday.`
								: `${ownerName}'s birthday is in ${occurrence.daysUntil} day${occurrence.daysUntil === 1 ? '' : 's'}. Start planning something special.`,
						dedupeKey: `birthday:${member.userId}:${occurrence.date.getFullYear()}`,
					});
				}

				/*
				 * ==========================================
				 * 2. RELATIONSHIP ANNIVERSARY — notify both
				 * ==========================================
				 */
				if (connection.connected_at) {
					const occurrence = nextAnnualOccurrence(connection.connected_at, today, {
						requireFirstAnniversary: true,
					});

					if (occurrence && occurrence.daysUntil <= 30) {
						for (const member of members) {
							await notifyUser(sql, {
								userId: member.userId,
								pushToken: member.pushToken,
								preferences: member.preferences,
								type: 'anniversary',
								title: 'Your relationship anniversary is coming up',
								message:
									occurrence.daysUntil === 0
										? `Today marks another year since you and ${member.partnerFirstName?.trim() || 'your partner'} connected.`
										: `Your relationship anniversary is in ${occurrence.daysUntil} day${occurrence.daysUntil === 1 ? '' : 's'}.`,
								dedupeKey: `anniversary:${connection.id}:${occurrence.date.getFullYear()}`,
							});
						}
					}
				}

				/*
				 * ==========================================
				 * 8. TRIVIA NUDGE — notify both, weekly
				 * ==========================================
				 */
				const lastTrivia = await sql`
					SELECT MAX(completed_at) AS last_played_at
					FROM trivia_sessions
					WHERE connection_id = ${connection.id}
				`;

				const lastPlayedAt = lastTrivia[0]?.last_played_at;

				const daysSincePlayed = lastPlayedAt ? Math.floor((today - new Date(lastPlayedAt)) / MS_PER_DAY) : Infinity;

				if (daysSincePlayed >= 7) {
					for (const member of members) {
						await notifyUser(sql, {
							userId: member.userId,
							pushToken: member.pushToken,
							preferences: member.preferences,
							type: 'trivia_nudge',
							title: 'Play a round of couple trivia',
							message: `See how well you know ${member.partnerFirstName?.trim() || 'your partner'}. A new round is waiting.`,
							dedupeKey: `trivia_nudge:${connection.id}:${weekKey}`,
						});
					}
				}

				/*
				 * ==========================================
				 * 11. DATE IDEA — notify both, weekly
				 * ==========================================
				 */
				const dateIdea = DATE_IDEAS[Math.floor(Math.random() * DATE_IDEAS.length)];

				for (const member of members) {
					await notifyUser(sql, {
						userId: member.userId,
						pushToken: member.pushToken,
						preferences: member.preferences,
						type: 'date_idea',
						title: 'A date idea for you two',
						message: dateIdea,
						dedupeKey: `date_idea:${connection.id}:${weekKey}`,
					});
				}
			}

			/*
			 * ==========================================
			 * 3 & 4. SHARED DREAMS — upcoming / overdue
			 * ==========================================
			 */
			const dreams = await sql`
				SELECT
					d.id,
					d.title,
					d.target_date,
					c.id AS connection_id,
					c.user_one,
					c.user_two,
					u1.push_token AS user_one_push_token,
					u2.push_token AS user_two_push_token,
					u1.notification_preferences AS user_one_preferences,
					u2.notification_preferences AS user_two_preferences
				FROM dreams d
				INNER JOIN connections c ON c.id = d.connection_id AND c.status = 'accepted'
				INNER JOIN users u1 ON u1.id = c.user_one
				INNER JOIN users u2 ON u2.id = c.user_two
				WHERE d.is_completed = false
					AND d.target_date IS NOT NULL
			`;

			for (const dream of dreams) {
				const daysUntil = Math.ceil((new Date(dream.target_date) - today) / MS_PER_DAY);

				const recipients = [
					{
						userId: dream.user_one,
						pushToken: dream.user_one_push_token,
						preferences: dream.user_one_preferences,
					},
					{
						userId: dream.user_two,
						pushToken: dream.user_two_push_token,
						preferences: dream.user_two_preferences,
					},
				];

				if (daysUntil >= 0 && daysUntil <= 14) {
					for (const recipient of recipients) {
						await notifyUser(sql, {
							userId: recipient.userId,
							pushToken: recipient.pushToken,
							preferences: recipient.preferences,
							type: 'dream_upcoming',
							title: 'Your dream is coming up',
							message:
								daysUntil === 0
									? `"${dream.title}" is scheduled for today.`
									: `"${dream.title}" is coming up in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
							dedupeKey: `dream_upcoming:${dream.id}`,
							data: { dreamId: dream.id },
						});
					}
				} else if (daysUntil < 0) {
					for (const recipient of recipients) {
						await notifyUser(sql, {
							userId: recipient.userId,
							pushToken: recipient.pushToken,
							preferences: recipient.preferences,
							type: 'dream_overdue',
							title: 'A shared dream needs attention',
							message: `"${dream.title}" has passed its target date. Maybe check in about it.`,
							dedupeKey: `dream_overdue:${dream.id}:${weekKey}`,
							data: { dreamId: dream.id },
						});
					}
				}
			}

			/*
			 * ==========================================
			 * 5 & 6. RELATIONSHIP GOALS — upcoming / overdue
			 * ==========================================
			 */
			const goals = await sql`
				SELECT
					g.id,
					g.title,
					g.target_date,
					c.id AS connection_id,
					c.user_one,
					c.user_two,
					u1.push_token AS user_one_push_token,
					u2.push_token AS user_two_push_token,
					u1.notification_preferences AS user_one_preferences,
					u2.notification_preferences AS user_two_preferences
				FROM relationship_goals g
				INNER JOIN connections c ON c.id = g.connection_id AND c.status = 'accepted'
				INNER JOIN users u1 ON u1.id = c.user_one
				INNER JOIN users u2 ON u2.id = c.user_two
				WHERE g.status = 'active'
					AND g.target_date IS NOT NULL
			`;

			for (const goal of goals) {
				const daysUntil = Math.ceil((new Date(goal.target_date) - today) / MS_PER_DAY);

				const recipients = [
					{
						userId: goal.user_one,
						pushToken: goal.user_one_push_token,
						preferences: goal.user_one_preferences,
					},
					{
						userId: goal.user_two,
						pushToken: goal.user_two_push_token,
						preferences: goal.user_two_preferences,
					},
				];

				if (daysUntil >= 0 && daysUntil <= 14) {
					for (const recipient of recipients) {
						await notifyUser(sql, {
							userId: recipient.userId,
							pushToken: recipient.pushToken,
							preferences: recipient.preferences,
							type: 'goal_upcoming',
							title: 'A relationship goal is approaching',
							message:
								daysUntil === 0
									? `"${goal.title}" is due today.`
									: `"${goal.title}" is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
							dedupeKey: `goal_upcoming:${goal.id}`,
							data: { goalId: goal.id },
						});
					}
				} else if (daysUntil < 0) {
					for (const recipient of recipients) {
						await notifyUser(sql, {
							userId: recipient.userId,
							pushToken: recipient.pushToken,
							preferences: recipient.preferences,
							type: 'goal_overdue',
							title: 'A relationship goal needs attention',
							message: `"${goal.title}" has passed its target date. Take a look together.`,
							dedupeKey: `goal_overdue:${goal.id}:${weekKey}`,
							data: { goalId: goal.id },
						});
					}
				}
			}

			/*
			 * ==========================================
			 * 7. SPECIAL DATES — notify owner + partner
			 * ==========================================
			 */
			const specialDates = await sql`
				SELECT
					sd.id,
					sd.user_id,
					sd.title,
					sd.event_date,
					owner.push_token AS owner_push_token,
					owner.notification_preferences AS owner_preferences,
					c.user_one,
					c.user_two,
					u1.push_token AS user_one_push_token,
					u2.push_token AS user_two_push_token,
					u1.notification_preferences AS user_one_preferences,
					u2.notification_preferences AS user_two_preferences
				FROM special_dates sd
				INNER JOIN users owner ON owner.id = sd.user_id
				LEFT JOIN connections c ON (c.user_one = sd.user_id OR c.user_two = sd.user_id) AND c.status = 'accepted'
				LEFT JOIN users u1 ON u1.id = c.user_one
				LEFT JOIN users u2 ON u2.id = c.user_two
			`;

			for (const specialDate of specialDates) {
				const occurrence = nextAnnualOccurrence(specialDate.event_date, today);

				if (!occurrence || occurrence.daysUntil > 30) continue;

				const message =
					occurrence.daysUntil === 0
						? `Today is "${specialDate.title}".`
						: `"${specialDate.title}" is in ${occurrence.daysUntil} day${occurrence.daysUntil === 1 ? '' : 's'}.`;

				const recipients = [
					{
						userId: specialDate.user_id,
						pushToken: specialDate.owner_push_token,
						preferences: specialDate.owner_preferences,
					},
				];

				if (specialDate.user_one) {
					const ownerIsUserOne = specialDate.user_one === specialDate.user_id;

					const partnerId = ownerIsUserOne ? specialDate.user_two : specialDate.user_one;

					const partnerPushToken = ownerIsUserOne ? specialDate.user_two_push_token : specialDate.user_one_push_token;

					const partnerPreferences = ownerIsUserOne ? specialDate.user_two_preferences : specialDate.user_one_preferences;

					recipients.push({
						userId: partnerId,
						pushToken: partnerPushToken,
						preferences: partnerPreferences,
					});
				}

				for (const recipient of recipients) {
					await notifyUser(sql, {
						userId: recipient.userId,
						pushToken: recipient.pushToken,
						preferences: recipient.preferences,
						type: 'special_date',
						title: 'A special date is coming up',
						message,
						dedupeKey: `special_date:${specialDate.id}:${occurrence.date.getFullYear()}`,
						data: { specialDateId: specialDate.id },
					});
				}
			}

			/*
			 * ==========================================
			 * 9. INACTIVITY — weekly nudge
			 * ==========================================
			 */
			const inactiveUsers = await sql`
				SELECT id, push_token, last_active_at, notification_preferences
				FROM users
				WHERE push_token IS NOT NULL
					AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '3 days')
			`;

			for (const user of inactiveUsers) {
				await notifyUser(sql, {
					userId: user.id,
					pushToken: user.push_token,
					preferences: user.notification_preferences,
					type: 'inactivity',
					title: 'We miss you on Between Us',
					message: "It's been a few days. Come see what's new with your relationship.",
					dedupeKey: `inactivity:${user.id}:${weekKey}`,
				});
			}

			/*
			 * ==========================================
			 * 12. DAILY QUESTION NUDGE
			 * ==========================================
			 *
			 * Only at one fixed hour, because the cron runs
			 * hourly and nobody wants this at 3am. The dedupe
			 * key is per day, so even if that hour is retried
			 * it still only goes out once.
			 */
			if (today.getUTCHours() === 17) {
				await ensureSchema(sql);

				const pending = await sql`
					SELECT
						c.id AS connection_id,
						u.id AS user_id,
						u.push_token,
						u.notification_preferences
					FROM connections c
					INNER JOIN users u
						ON u.id = c.user_one OR u.id = c.user_two
					WHERE c.status = 'accepted'
						AND NOT EXISTS (
							SELECT 1
							FROM daily_answers d
							WHERE d.user_id = u.id
								AND d.question_date = ${todayIso}
						)
				`;

				for (const row of pending) {
					await notifyUser(sql, {
						userId: row.user_id,
						pushToken: row.push_token,
						preferences: row.notification_preferences,
						type: 'daily_question',
						title: "Today's question is waiting",
						message: 'Answer it to unlock what your partner said.',
						dedupeKey: `daily_question:${todayIso}`,
					});
				}
			}

			/*
			 * ==========================================
			 * 10. QUOTE OF THE DAY — everyone, daily
			 * ==========================================
			 */
			const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / MS_PER_DAY);

			const quote = QUOTES_OF_THE_DAY[dayOfYear % QUOTES_OF_THE_DAY.length];

			const usersWithPush = await sql`
				SELECT id, push_token, notification_preferences
				FROM users
				WHERE push_token IS NOT NULL
			`;

			for (const user of usersWithPush) {
				await notifyUser(sql, {
					userId: user.id,
					pushToken: user.push_token,
					preferences: user.notification_preferences,
					type: 'quote_of_day',
					title: 'Quote of the Day',
					message: quote,
					dedupeKey: `quote_of_day:${todayIso}`,
				});
			}

			console.log('BETWEEN US: Scheduled notification job finished');
		} catch (error) {
			console.error('SCHEDULED JOB ERROR:', error);
		}
	},

	async fetch(request, env) {
		try {
			const sql = neon(env.DATABASE_URL);
			const url = new URL(request.url);

			/*
			 * ==========================================
			 * GATE EVERY REQUEST
			 * ==========================================
			 */

			if (!PUBLIC_PATHS.has(url.pathname)) {
				const callerId = await verifySessionToken(request, env);

				if (!callerId) {
					return unauthorized('Sign in to continue.');
				}

				/*
				 * A path naming a user must name the caller.
				 * This is what stops someone reading another
				 * person's data by swapping the id in the URL.
				 */
				const pathUser = url.pathname.match(/^\/users\/([^/]+)/);

				if (pathUser && pathUser[1] !== callerId) {
					return forbidden();
				}

				/* Same rule for ids in the query string. */
				const queryId = url.searchParams.get('clerk_id');

				if (queryId && queryId !== callerId) {
					return forbidden();
				}

				/*
				 * ...and in the body. Read from a clone so the
				 * handlers can still consume the original.
				 */
				if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
					try {
						const peek = await request.clone().json();

						for (const field of ['clerk_id', 'from_clerk_id']) {
							if (peek?.[field] && peek[field] !== callerId) {
								return forbidden();
							}
						}
					} catch {
						/* not JSON, nothing to check */
					}
				}
			}

			/*
			 * ==========================================
			 * HEALTH
			 * ==========================================
			 */

			if (url.pathname === '/health' && request.method === 'GET') {
				const result = await sql`
          SELECT NOW() AS time
        `;

				return Response.json({
					status: 'ok',
					database: true,
					time: result[0].time,
				});
			}

			/*
			 * ==========================================
			 * API HOME
			 * ==========================================
			 */

			if (url.pathname === '/' && request.method === 'GET') {
				return Response.json({
					message: 'Between Us API is running',
				});
			}

			/*
			 * ==========================================
			 * GET ALL USERS -- REMOVED
			 * ==========================================
			 *
			 * This handed every user's email and clerk_id to
			 * anyone who asked, which made it trivial to scrape
			 * the directory and then read or overwrite those
			 * accounts. Nothing in the app used it.
			 */

			/*
			 * ==========================================
			 * CREATE USER
			 * ==========================================
			 */

			if (url.pathname === '/users' && request.method === 'POST') {
				const body = await request.json();

				const { clerk_id, email } = body;

				if (!clerk_id || !email) {
					return Response.json(
						{
							error: 'clerk_id and email are required',
						},
						{ status: 400 },
					);
				}

				const existing = await sql`
          SELECT
            id,
            clerk_id,
            email,
            created_at
          FROM users
          WHERE clerk_id = ${clerk_id}
          LIMIT 1
        `;

				if (existing.length > 0) {
					return Response.json({
						message: 'User already exists',
						user: existing[0],
					});
				}

				const result = await sql`
          INSERT INTO users (
            clerk_id,
            email
          )
          VALUES (
            ${clerk_id},
            ${email}
          )
          RETURNING
            id,
            clerk_id,
            email,
            created_at
        `;

				return Response.json(
					{
						message: 'User created',
						user: result[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * SAVE PUSH TOKEN
			 * ==========================================
			 *
			 * POST /users/:clerkId/push-token
			 */

			const pushTokenMatch = url.pathname.match(/^\/users\/([^/]+)\/push-token$/);

			if (pushTokenMatch && request.method === 'POST') {
				const clerkId = pushTokenMatch[1];
				const body = await request.json();

				const { push_token, platform } = body;

				if (!push_token) {
					return Response.json(
						{
							error: 'push_token is required',
						},
						{ status: 400 },
					);
				}

				const result = await sql`
          UPDATE users
          SET push_token = ${push_token}
          WHERE clerk_id = ${clerkId}
          RETURNING
            id,
            clerk_id,
            push_token
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Push token saved',
					user: result[0],
					platform: platform || null,
				});
			}
			/*
			 * ==========================================
			 * DELETE USER ACCOUNT
			 * ==========================================
			 *
			 * DELETE /users/:clerkId
			 */

			const deleteUserMatch = url.pathname.match(/^\/users\/([^/]+)$/);

			if (deleteUserMatch && request.method === 'DELETE') {
				const clerkId = deleteUserMatch[1];

				const userResult = await sql`
          SELECT
            id,
            clerk_id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				await sql`
          DELETE FROM users
          WHERE id = ${userId}
        `;

				return Response.json({
					message: 'User account deleted successfully',
				});
			}
			/*
			 * ==========================================
			 * SAVE ONBOARDING
			 * ==========================================
			 */

			if (url.pathname === '/onboarding' && request.method === 'POST') {
				const body = await request.json();

				const {
					clerk_id,
					email,
					firstName,
					birthday,
					gender,
					country,
					relationshipStatus,
					communicationStyle,
					affectionStyle,
					loveLanguages,
					favoriteFood,
					favoriteSnack,
					favoriteDrink,
					favoriteColor,
					musicGenre,
					movieGenre,
					personalityType,
					conflictStyle,
					focusAreas,
				} = body;

				if (!clerk_id || !email || !firstName || !birthday) {
					return Response.json(
						{
							error: 'clerk_id, email, firstName and birthday are required',
						},
						{ status: 400 },
					);
				}

				let userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerk_id}
          LIMIT 1
        `;

				let userId;

				if (userResult.length === 0) {
					const newUser = await sql`
            INSERT INTO users (
              clerk_id,
              email
            )
            VALUES (
              ${clerk_id},
              ${email}
            )
            RETURNING id
          `;

					userId = newUser[0].id;
				} else {
					userId = userResult[0].id;
				}

				const normalizedBirthday = String(birthday).trim();

				const onboardingBirthdayProblem = birthdayProblem(normalizedBirthday);

				if (onboardingBirthdayProblem) {
					return Response.json(
						{
							error: onboardingBirthdayProblem,
						},
						{ status: 400 },
					);
				}

				const profileResult = await sql`
          INSERT INTO profiles (
            user_id,
            first_name,
            birthday,
            gender,
            country,
            relationship_status
          )
          VALUES (
            ${userId},
            ${firstName.trim()},
            ${normalizedBirthday},
            ${gender || null},
            ${country || null},
            ${relationshipStatus || null}
          )
          ON CONFLICT (user_id)
          DO UPDATE SET
            first_name = EXCLUDED.first_name,
            birthday = EXCLUDED.birthday,
            gender = EXCLUDED.gender,
            country = EXCLUDED.country,
            relationship_status = EXCLUDED.relationship_status
          RETURNING
            id,
            user_id,
            first_name,
            birthday,
            gender,
            country,
            relationship_status
        `;

				const languages = Array.isArray(loveLanguages) ? loveLanguages.filter(Boolean) : [];

				await sql`
          INSERT INTO preferences (
            user_id,
            love_languages,
            favorite_food,
            favorite_snack,
            favorite_drink,
            favorite_color,
            movie_genre,
            music_genre,
            communication_frequency,
            affection_style
          )
          VALUES (
            ${userId},
            ${languages},
            ${favoriteFood || null},
            ${favoriteSnack || null},
            ${favoriteDrink || null},
            ${favoriteColor || null},
            ${movieGenre || null},
            ${musicGenre || null},
            ${communicationStyle || null},
            ${affectionStyle || null}
          )
          ON CONFLICT (user_id)
          DO UPDATE SET
            love_languages = EXCLUDED.love_languages,
            favorite_food = EXCLUDED.favorite_food,
            favorite_snack = EXCLUDED.favorite_snack,
            favorite_drink = EXCLUDED.favorite_drink,
            favorite_color = EXCLUDED.favorite_color,
            movie_genre = EXCLUDED.movie_genre,
            music_genre = EXCLUDED.music_genre,
            communication_frequency =
              EXCLUDED.communication_frequency,
            affection_style = EXCLUDED.affection_style
        `;

				const insightFocusAreas = Array.isArray(focusAreas) ? focusAreas.filter(Boolean) : [];

				await sql`
  DELETE FROM relationship_insights
  WHERE user_id = ${userId}
`;

				await sql`
  INSERT INTO relationship_insights (
    user_id,
    personality_type,
    conflict_style,
    focus_areas
  )
  VALUES (
    ${userId},
    ${personalityType || null},
    ${conflictStyle || null},
    ${insightFocusAreas}
  )
`;

				return Response.json(
					{
						message: 'Onboarding saved successfully',
						profile: profileResult[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * GET USER PREFERENCES
			 * ==========================================
			 *
			 * GET /users/:clerkId/preferences
			 */

			const preferencesMatch = url.pathname.match(/^\/users\/([^/]+)\/preferences$/);

			if (preferencesMatch && request.method === 'GET') {
				const clerkId = preferencesMatch[1];

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const result = await sql`
    SELECT
      id,
      user_id,
      love_languages,
      favorite_food,
      favorite_snack,
      favorite_drink,
      favorite_color,
      movie_genre,
      music_genre,
      communication_frequency,
      affection_style
    FROM preferences
    WHERE user_id = ${userId}
    LIMIT 1
  `;

				if (result.length === 0) {
					return Response.json({
						exists: false,
						preferences: null,
					});
				}

				return Response.json({
					exists: true,
					preferences: result[0],
				});
			}
			/*
			 * ==========================================
			 * GET USER PROFILE
			 * ==========================================
			 */

			const profileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);
			/*
			 * ==========================================
			 * GET USER INSIGHTS
			 * ==========================================
			 */

			const insightsMatch = url.pathname.match(/^\/users\/([^/]+)\/insights$/);

			if (insightsMatch && request.method === 'GET') {
				const clerkId = insightsMatch[1];

				const result = await sql`
    SELECT
      ri.id,
      ri.user_id,
      ri.personality_type,
      ri.conflict_style,
      ri.focus_areas,
      ri.created_at
    FROM relationship_insights ri
    INNER JOIN users u
      ON ri.user_id = u.id
    WHERE u.clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (result.length === 0) {
					return Response.json({
						exists: false,
						insights: null,
					});
				}

				return Response.json({
					exists: true,
					insights: result[0],
				});
			}

			if (profileMatch && request.method === 'GET') {
				const clerkId = profileMatch[1];

				const result = await sql`
          SELECT
  p.id,
  p.user_id,
  p.first_name,
  p.last_name,
  p.birthday,
  p.gender,
  p.country,
  p.relationship_status
FROM profiles p
          INNER JOIN users u
            ON p.user_id = u.id
          WHERE u.clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (result.length === 0) {
					return Response.json({
						exists: false,
						profile: null,
					});
				}

				return Response.json({
					exists: true,
					profile: result[0],
				});
			}

			/*
			 * ==========================================
			 * SAVE USER PROFILE
			 * ==========================================
			 */

			const saveProfileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);

			if (saveProfileMatch && request.method === 'POST') {
				const clerkId = saveProfileMatch[1];

				const body = await request.json();

				const { firstName, lastName, birthday, gender, country, relationshipStatus } = body;

				if (!firstName || !birthday || !gender || !country || !relationshipStatus) {
					return Response.json(
						{
							error: 'Required profile fields are missing',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const existingProfile = await sql`
          SELECT id
          FROM profiles
          WHERE user_id = ${userId}
          LIMIT 1
        `;

				let profile;

				if (existingProfile.length > 0) {
					const result = await sql`
            UPDATE profiles
SET
  first_name = ${firstName},
  last_name = ${lastName || null},
  birthday = ${birthday},
              gender = ${gender},
              country = ${country},
              relationship_status = ${relationshipStatus}
            WHERE user_id = ${userId}
            RETURNING
              id,
              user_id,
              first_name,
              birthday,
              gender,
              country,
              relationship_status
          `;

					profile = result[0];
				} else {
					const result = await sql`
            INSERT INTO profiles (
              user_id,
              first_name,
              birthday,
              gender,
              country,
              relationship_status
            )
            VALUES (
              ${userId},
              ${firstName},
              ${birthday},
              ${gender},
              ${country},
              ${relationshipStatus}
            )
            RETURNING
              id,
              user_id,
              first_name,
              birthday,
              gender,
              country,
              relationship_status
          `;

					profile = result[0];
				}

				return Response.json({
					message: 'Profile saved successfully',
					profile,
				});
			}

			/*
			 * ==========================================
			 * SEARCH USERS
			 * ==========================================
			 *
			 * GET /search?query=ella&clerk_id=xxx
			 *
			 * Users who are already connected cannot
			 * appear in search results.
			 */

			if (url.pathname === '/search' && request.method === 'GET') {
				const query = (url.searchParams.get('query') || '').trim();
				const clerkId = url.searchParams.get('clerk_id');

				/*
				 * A one-letter search would page through the whole
				 * user base, so ask for at least two characters.
				 */
				if (query.length < 2 && clerkId) {
					return Response.json([]);
				}

				if (!query || !clerkId) {
					return Response.json(
						{
							error: 'query and clerk_id are required',
						},
						{ status: 400 },
					);
				}

				const currentUser = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (currentUser.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const currentUserId = currentUser[0].id;

				const results = await sql`
          SELECT
            u.id,
            u.clerk_id,
            p.first_name,
            p.country,
            p.gender,
            p.relationship_status

          FROM users u

          INNER JOIN profiles p
            ON p.user_id = u.id

          WHERE
            u.id != ${currentUserId}

            AND (
              p.first_name ILIKE ${'%' + query + '%'}
              /*
               * Email only on an exact match. Substring matching
               * let "@gmail" list everyone along with their address.
               */
              OR LOWER(u.email) = LOWER(${query})
            )

            /*
             * Don't show someone who already has
             * an accepted connection.
             */
            AND NOT EXISTS (
              SELECT 1
              FROM connections c
              WHERE
                (
                  c.user_one = ${currentUserId}
                  AND c.user_two = u.id
                )
                OR
                (
                  c.user_one = u.id
                  AND c.user_two = ${currentUserId}
                )
                AND c.status = 'accepted'
            )

            /*
             * Don't show someone already connected
             * to somebody else.
             */
            AND NOT EXISTS (
              SELECT 1
              FROM connections c
              WHERE
                (
                  c.user_one = u.id
                  OR c.user_two = u.id
                )
                AND c.status = 'accepted'
            )

          ORDER BY p.first_name ASC

          LIMIT 20
        `;

				return Response.json(results);
			}

			/*
			 * ==========================================
			 * CREATE CONNECTION REQUEST
			 * ==========================================
			 *
			 * POST /connections
			 */

			if (url.pathname === '/connections' && request.method === 'POST') {
				const body = await request.json();

				const { from_clerk_id, to_clerk_id, relationship_type } = body;

				if (!from_clerk_id || !to_clerk_id || !relationship_type) {
					return Response.json(
						{
							error: 'from_clerk_id, to_clerk_id and relationship_type are required',
						},
						{ status: 400 },
					);
				}

				if (from_clerk_id === to_clerk_id) {
					return Response.json(
						{
							error: 'You cannot connect with yourself',
						},
						{ status: 400 },
					);
				}

				const users = await sql`
          SELECT
            id,
            clerk_id
          FROM users
          WHERE clerk_id IN (
            ${from_clerk_id},
            ${to_clerk_id}
          )
        `;

				if (users.length !== 2) {
					return Response.json(
						{
							error: 'One or both users do not exist',
						},
						{ status: 404 },
					);
				}

				const sender = users.find((user) => user.clerk_id === from_clerk_id);

				const receiver = users.find((user) => user.clerk_id === to_clerk_id);

				/*
				 * Check for ANY existing relationship
				 * between these two people.
				 */

				const existing = await sql`
          SELECT
            id,
            user_one,
            user_two,
            requester_id,
            recipient_id,
            relationship_type,
            status,
            created_at,
            connected_at
          FROM connections
          WHERE
            (
              user_one = ${sender.id}
              AND user_two = ${receiver.id}
            )
            OR
            (
              user_one = ${receiver.id}
              AND user_two = ${sender.id}
            )
          ORDER BY created_at DESC
          LIMIT 1
        `;

				if (existing.length > 0) {
					const connection = existing[0];

					if (connection.status === 'accepted') {
						return Response.json(
							{
								error: 'You are already connected with this person',
							},
							{ status: 409 },
						);
					}

					if (connection.status === 'pending') {
						return Response.json(
							{
								error: 'A connection request already exists',
								connection,
							},
							{ status: 409 },
						);
					}
				}

				/*
				 * Sender must not already have another
				 * accepted connection.
				 */

				const senderConnection = await sql`
          SELECT id
          FROM connections
          WHERE
            (
              user_one = ${sender.id}
              OR user_two = ${sender.id}
            )
            AND status = 'accepted'
          LIMIT 1
        `;

				if (senderConnection.length > 0) {
					return Response.json(
						{
							error: 'You are already connected with someone',
						},
						{ status: 409 },
					);
				}

				/*
				 * Receiver must not already have another
				 * accepted connection.
				 */

				const receiverConnection = await sql`
          SELECT id
          FROM connections
          WHERE
            (
              user_one = ${receiver.id}
              OR user_two = ${receiver.id}
            )
            AND status = 'accepted'
          LIMIT 1
        `;

				if (receiverConnection.length > 0) {
					return Response.json(
						{
							error: 'This person is already connected with someone',
						},
						{ status: 409 },
					);
				}

				/*
				 * Create the request.
				 *
				 * requester_id = person sending request
				 * recipient_id = person receiving request
				 */

				const result = await sql`
          INSERT INTO connections (
  user_one,
  user_two,
  requester_id,
  recipient_id,
  relationship_type,
  status
)
VALUES (
  ${sender.id},
  ${receiver.id},
  ${sender.id},
  ${receiver.id},
  ${relationship_type},
  'pending'
)
          RETURNING
            id,
            user_one,
            user_two,
            requester_id,
            recipient_id,
            relationship_type,
            status,
            created_at
                  `;

				await sql`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message
          )
          VALUES (
            ${receiver.id},
            'connection_request',
            'New connection request',
            'You have received a new connection request on Between Us.'
          )
        `;

				const receiverPush = await sql`
  SELECT push_token
  FROM users
  WHERE id = ${receiver.id}
  LIMIT 1
`;

				if (receiverPush[0]?.push_token) {
					await sendPushNotification({
						pushToken: receiverPush[0].push_token,
						title: 'New connection request',
						body: 'You have received a new connection request on Between Us.',
						data: {
							type: 'connection_request',
							connectionId: result[0].id,
						},
					});
				}
				return Response.json(
					{
						message: 'Connection request sent',
						connection: result[0],
					},
					{ status: 201 },
				);
			}

			/*
			 * ==========================================
			 * GET CONNECTIONS
			 * ==========================================
			 *
			 * GET /users/:clerkId/connections
			 */

			const connectionsMatch = url.pathname.match(/^\/users\/([^/]+)\/connections$/);

			if (connectionsMatch && request.method === 'GET') {
				const clerkId = connectionsMatch[1];

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const connections = await sql`
    SELECT
      c.id,
      c.user_one,
      c.user_two,
      c.requester_id,
      c.recipient_id,
      c.relationship_type,
      c.status,
      c.created_at,

      CASE
        WHEN c.user_one = ${userId}
        THEN u2.clerk_id
        ELSE u1.clerk_id
      END AS other_clerk_id,

      CASE
        WHEN c.user_one = ${userId}
        THEN p2.first_name
        ELSE p1.first_name
      END AS other_first_name,

      CASE
        WHEN c.requester_id = ${userId}
        THEN 'outgoing'
        WHEN c.recipient_id = ${userId}
        THEN 'incoming'
        ELSE NULL
      END AS request_direction

    FROM connections c

    INNER JOIN users u1
      ON c.user_one = u1.id

    INNER JOIN users u2
      ON c.user_two = u2.id

    LEFT JOIN profiles p1
      ON p1.user_id = u1.id

    LEFT JOIN profiles p2
      ON p2.user_id = u2.id

    WHERE
      c.user_one = ${userId}
      OR c.user_two = ${userId}

    ORDER BY c.created_at DESC
  `;

				return Response.json(connections);
			}

			/*
			 * ==========================================
			 * GET INCOMING REQUESTS
			 * ==========================================
			 *
			 * GET /users/:clerkId/connection-requests
			 */

			const requestsMatch = url.pathname.match(/^\/users\/([^/]+)\/connection-requests$/);

			if (requestsMatch && request.method === 'GET') {
				const clerkId = requestsMatch[1];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const requests = await sql`
          SELECT
            c.id,
            c.relationship_type,
            c.status,
            c.created_at,

            u.clerk_id AS requester_clerk_id,
            u.email AS requester_email,

            p.first_name AS requester_first_name,
            p.country AS requester_country,
            p.gender AS requester_gender,
            p.relationship_status AS requester_relationship_status

          FROM connections c

          INNER JOIN users u
            ON u.id = c.requester_id

          INNER JOIN profiles p
            ON p.user_id = u.id

          WHERE
            c.recipient_id = ${userId}
            AND c.status = 'pending'

          ORDER BY c.created_at DESC
        `;

				return Response.json(requests);
			}

			/*
			 * ==========================================
			 * ACCEPT CONNECTION
			 * ==========================================
			 *
			 * POST /connections/:id/accept
			 *
			 * Body:
			 * {
			 *   clerk_id: "current-user-clerk-id"
			 * }
			 */

			const acceptMatch = url.pathname.match(/^\/connections\/([^/]+)\/accept$/);

			if (acceptMatch && request.method === 'POST') {
				const connectionId = acceptMatch[1];

				const body = await request.json();
				const { clerk_id } = body;

				if (!clerk_id) {
					return Response.json(
						{
							error: 'clerk_id is required',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerk_id}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const result = await sql`
    UPDATE connections
    SET
      status = 'accepted',
      connected_at = NOW()
    WHERE
      id = ${connectionId}
      AND recipient_id = ${userId}
      AND status = 'pending'
    RETURNING
      id,
      user_one,
      user_two,
      requester_id,
      recipient_id,
      relationship_type,
      status,
      connected_at,
      created_at
  `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection request not found or you are not the recipient',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Connection accepted',
					connection: result[0],
				});
			}

			/*
			 * ==========================================
			 * REJECT CONNECTION
			 * ==========================================
			 *
			 * POST /connections/:id/reject
			 */

			const rejectMatch = url.pathname.match(/^\/connections\/([^/]+)\/reject$/);

			if (rejectMatch && request.method === 'POST') {
				const connectionId = rejectMatch[1];

				const body = await request.json();
				const { clerk_id } = body;

				if (!clerk_id) {
					return Response.json(
						{
							error: 'clerk_id is required',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerk_id}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const result = await sql`
    UPDATE connections
    SET status = 'rejected'
    WHERE
      id = ${connectionId}
      AND recipient_id = ${userId}
      AND status = 'pending'
    RETURNING
      id,
      user_one,
      user_two,
      requester_id,
      recipient_id,
      relationship_type,
      status,
      created_at
  `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection request not found or you are not the recipient',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Connection request rejected',
					connection: result[0],
				});
			}

			/*
			 * ==========================================
			 * CANCEL OUTGOING REQUEST
			 * ==========================================
			 *
			 * DELETE /connections/:id/request
			 */

			const cancelRequestMatch = url.pathname.match(/^\/connections\/([^/]+)\/request$/);

			if (cancelRequestMatch && request.method === 'DELETE') {
				const connectionId = cancelRequestMatch[1];

				const clerkId = url.searchParams.get('clerk_id');

				if (!clerkId) {
					return Response.json(
						{
							error: 'clerk_id is required',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const result = await sql`
          DELETE FROM connections
          WHERE
            id = ${connectionId}
            AND requester_id = ${userId}
            AND status = 'pending'
          RETURNING id
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Request not found or you are not allowed to cancel it',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Connection request cancelled',
				});
			}
			/*
			 * ==========================================
			 * UNLINK PARTNER
			 * ==========================================
			 *
			 * DELETE /users/:clerkId/connection
			 */

			const unlinkMatch = url.pathname.match(/^\/users\/([^/]+)\/connection$/);

			if (unlinkMatch && request.method === 'DELETE') {
				const clerkId = unlinkMatch[1];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
          SELECT
            id,
            user_one,
            user_two
          FROM connections
          WHERE
            (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'No active connection found',
						},
						{ status: 404 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				const userProfile = await sql`
          SELECT first_name
          FROM profiles
          WHERE user_id = ${userId}
          LIMIT 1
        `;

				const userName = userProfile[0]?.first_name || 'Your partner';

				await sql`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message
          )
          VALUES (
            ${partnerId},
            'connection_unlinked',
            'Connection ended',
            ${`${userName} has ended your connection on Between Us.`}
          )
        `;

				await sql`
          DELETE FROM connections
          WHERE id = ${connection.id}
        `;

				return Response.json({
					message: 'Connection ended successfully',
				});
			}
			/*
			 * ==========================================
			 * DISCONNECT
			 * ==========================================
			 *
			 * DELETE /connections/:id?clerk_id=...
			 *
			 * Only someone who belongs to the connection
			 * can remove it.
			 */

			const deleteMatch = url.pathname.match(/^\/connections\/([^/]+)$/);

			if (deleteMatch && request.method === 'DELETE') {
				const connectionId = deleteMatch[1];

				const clerkId = url.searchParams.get('clerk_id');

				if (!clerkId) {
					return Response.json(
						{
							error: 'clerk_id is required',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const result = await sql`
          DELETE FROM connections
          WHERE
            id = ${connectionId}
            AND (
              user_one = ${userId}
              OR user_two = ${userId}
            )
          RETURNING id
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection not found or you are not allowed to remove it',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Connection removed',
				});
			}

			/*
			 * ==========================================
			 * GET PENDING CONNECTION REQUESTS
			 * ==========================================
			 *
			 * GET /users/:clerkId/connection-requests
			 *
			 * Returns only requests where the logged-in
			 * user is the recipient.
			 */

			const pendingRequestsMatch = url.pathname.match(/^\/users\/([^/]+)\/connection-requests$/);

			if (pendingRequestsMatch && request.method === 'GET') {
				const clerkId = pendingRequestsMatch[1];

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const requests = await sql`
    SELECT
      c.id,
      c.relationship_type,
      c.status,
      c.created_at,

      sender.clerk_id AS requester_clerk_id,
      sender.email AS requester_email,

      sender_profile.first_name AS requester_first_name,
      sender_profile.country AS requester_country,
      sender_profile.gender AS requester_gender,
      sender_profile.relationship_status AS requester_relationship_status

    FROM connections c

    INNER JOIN users sender
      ON sender.id = c.user_one

    LEFT JOIN profiles sender_profile
      ON sender_profile.user_id = sender.id

    WHERE
      c.user_two = ${userId}
      AND c.status = 'pending'

    ORDER BY c.created_at DESC
  `;

				return Response.json(requests);
			}

			/*
			 * ==========================================
			 * CREATE MEMORY
			 * ==========================================
			 *
			 * POST /users/:clerkId/memories
			 */

			const createMemoryMatch = url.pathname.match(/^\/users\/([^/]+)\/memories$/);

			if (createMemoryMatch && request.method === 'POST') {
				const clerkId = createMemoryMatch[1];

				const body = await request.json();

				const { title, description, memory_date } = body;

				if (!title || !String(title).trim()) {
					return Response.json(
						{
							error: 'Memory title is required',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
    SELECT
      user_one,
      user_two
    FROM connections
    WHERE
      (
        user_one = ${userId}
        OR user_two = ${userId}
      )
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You must be connected before creating a memory',
						},
						{ status: 403 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				const result = await sql`
    INSERT INTO memories (
      user_one,
      user_two,
      created_by,
      title,
      description,
      memory_date
    )
    VALUES (
      ${userId},
      ${partnerId},
      ${userId},
      ${String(title).trim()},
      ${description ? String(description).trim() : null},
      ${memory_date || new Date().toISOString().slice(0, 10)}
    )
    RETURNING
      id,
      user_one,
      user_two,
      created_by,
      title,
      description,
      memory_date,
      created_at,
      updated_at
  `;

				return Response.json(
					{
						message: 'Memory created successfully',
						memory: result[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * CREATE MEMORY
			 * ==========================================
			 *
			 * POST /memories
			 *
			 * Body:
			 * {
			 *   clerk_id: "current-user-clerk-id",
			 *   title: "Our first date",
			 *   description: "We went to the beach",
			 *   memory_date: "2026-08-20"
			 * }
			 */

			if (url.pathname === '/memories' && request.method === 'POST') {
				const body = await request.json();

				const { clerk_id, title, description, memory_date } = body;

				if (!clerk_id || !title) {
					return Response.json(
						{
							error: 'clerk_id and title are required',
						},
						{ status: 400 },
					);
				}
				/*
				 * ==========================================
				 * DELETE MEMORY
				 * ==========================================
				 *
				 * DELETE /memories/:id?clerk_id=...
				 *
				 * Only the person who created the memory
				 * can delete it.
				 */

				const deleteMemoryMatch = url.pathname.match(/^\/memories\/([^/]+)$/);

				if (deleteMemoryMatch && request.method === 'DELETE') {
					const memoryId = deleteMemoryMatch[1];
					const clerkId = url.searchParams.get('clerk_id');

					if (!clerkId) {
						return Response.json(
							{
								error: 'clerk_id is required',
							},
							{ status: 400 },
						);
					}

					const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

					if (userResult.length === 0) {
						return Response.json(
							{
								error: 'User not found',
							},
							{ status: 404 },
						);
					}

					const userId = userResult[0].id;

					const result = await sql`
    DELETE FROM memories
    WHERE
      id = ${memoryId}
      AND created_by = ${userId}
    RETURNING id
  `;

					if (result.length === 0) {
						return Response.json(
							{
								error: 'Memory not found or you are not allowed to delete it',
							},
							{ status: 404 },
						);
					}

					return Response.json({
						message: 'Memory deleted successfully',
					});
				}
				/*
				 * Find the logged-in user
				 */

				const userResult = await sql`
                    SELECT id
                    FROM users
                    WHERE clerk_id = ${clerk_id}
                    LIMIT 1
                `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				/*
				 * Find the user's accepted connection
				 */

				const connectionResult = await sql`
                    SELECT
                        user_one,
                        user_two
                    FROM connections
                    WHERE
                        (
                            user_one = ${userId}
                            OR user_two = ${userId}
                        )
                        AND status = 'accepted'
                    LIMIT 1
                `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You must be connected to someone before creating a memory',
						},
						{ status: 409 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				/*
				 * Create the memory
				 */

				const result = await sql`
                    INSERT INTO memories (
                        user_one,
                        user_two,
                        created_by,
                        title,
                        description,
                        memory_date
                    )
                    VALUES (
                        ${userId},
                        ${partnerId},
                        ${userId},
                        ${title.trim()},
                        ${description?.trim() || null},
                        ${memory_date || new Date().toISOString().split('T')[0]}
                    )
                    RETURNING
                        id,
                        user_one,
                        user_two,
                        created_by,
                        title,
                        description,
                        memory_date,
                        created_at,
                        updated_at
                `;

				return Response.json(
					{
						message: 'Memory created successfully',
						memory: result[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * MEMORIES
			 * ==========================================
			 *
			 * GET /users/:clerkId/memories
			 * POST /users/:clerkId/memories
			 *
			 * Memories belong to both people in an
			 * accepted connection.
			 */

			// GET MEMORIES
			const memoriesMatch = url.pathname.match(/^\/users\/([^/]+)\/memories$/);
			/*
			 * ==========================================
			 * UPDATE MEMORY
			 * ==========================================
			 *
			 * PUT /users/:clerkId/memories/:memoryId
			 *
			 * Only the person who created the memory
			 * can edit it.
			 */

			const updateMemoryMatch = url.pathname.match(/^\/users\/([^/]+)\/memories\/([^/]+)$/);

			if (updateMemoryMatch && request.method === 'PUT') {
				const clerkId = updateMemoryMatch[1];
				const memoryId = updateMemoryMatch[2];

				const body = await request.json();

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const memoryResult = await sql`
    SELECT id, created_by, memory_date
    FROM memories
    WHERE id = ${memoryId}
    LIMIT 1
  `;

				if (memoryResult.length === 0) {
					return Response.json(
						{
							error: 'Memory not found',
						},
						{ status: 404 },
					);
				}

				const memory = memoryResult[0];

				if (memory.created_by !== userId) {
					return Response.json(
						{
							error: 'You can only edit memories you created.',
						},
						{ status: 403 },
					);
				}

				const newMemoryDate = body.memory_date !== undefined ? body.memory_date || null : memory.memory_date;

				const updatedMemory = await sql`
    UPDATE memories
    SET
      title = ${body.title?.trim() || ''},
      description = ${body.description?.trim() || ''},
      memory_date = ${newMemoryDate},
      updated_at = NOW()
    WHERE id = ${memoryId}
      AND created_by = ${userId}
    RETURNING
      id,
      title,
      description,
      memory_date,
      created_at,
      updated_at,
      created_by,
      user_one,
      user_two
  `;

				return Response.json({
					message: 'Memory updated successfully',
					memory: updatedMemory[0],
				});
			}
			/*
			 * ==========================================
			 * DELETE MEMORY
			 * ==========================================
			 *
			 * DELETE /users/:clerkId/memories/:memoryId
			 *
			 * Only the person who created the memory
			 * can delete it.
			 */

			const deleteMemoryMatch = url.pathname.match(/^\/users\/([^/]+)\/memories\/([^/]+)$/);

			if (deleteMemoryMatch && request.method === 'DELETE') {
				const clerkId = deleteMemoryMatch[1];
				const memoryId = deleteMemoryMatch[2];

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const memoryResult = await sql`
    SELECT id, created_by
    FROM memories
    WHERE id = ${memoryId}
    LIMIT 1
  `;

				if (memoryResult.length === 0) {
					return Response.json(
						{
							error: 'Memory not found',
						},
						{ status: 404 },
					);
				}

				const memory = memoryResult[0];

				if (memory.created_by !== userId) {
					return Response.json(
						{
							error: 'You can only delete memories you created.',
						},
						{ status: 403 },
					);
				}

				await sql`
    DELETE FROM memories
    WHERE id = ${memoryId}
      AND created_by = ${userId}
  `;

				return Response.json({
					message: 'Memory deleted successfully',
				});
			}
			if (memoriesMatch && request.method === 'GET') {
				const clerkId = memoriesMatch[1];

				// Find current user
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				// Find the user's accepted connection
				const connectionResult = await sql`
    SELECT
      user_one,
      user_two
    FROM connections
    WHERE
      (
        user_one = ${userId}
        OR user_two = ${userId}
      )
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json([]);
				}

				const connection = connectionResult[0];

				// Get memories shared between the two users
				const memories = await sql`
    SELECT
      id,
      user_one,
      user_two,
      created_by,
      title,
      description,
      memory_date,
      created_at,
      updated_at
    FROM memories
    WHERE
      user_one = ${connection.user_one}
      AND user_two = ${connection.user_two}

      OR

      user_one = ${connection.user_two}
      AND user_two = ${connection.user_one}

    ORDER BY memory_date DESC, created_at DESC
  `;

				return Response.json(memories);
			}

			// CREATE MEMORY
			if (memoriesMatch && request.method === 'POST') {
				const clerkId = memoriesMatch[1];

				const body = await request.json();

				const { title, description, memory_date } = body;

				if (!title) {
					return Response.json(
						{
							error: 'title is required',
						},
						{ status: 400 },
					);
				}

				// Find current user
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				// Find accepted connection
				const connectionResult = await sql`
    SELECT
      user_one,
      user_two
    FROM connections
    WHERE
      (
        user_one = ${userId}
        OR user_two = ${userId}
      )
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not connected to anyone',
						},
						{ status: 400 },
					);
				}

				const connection = connectionResult[0];

				// Create the memory
				const result = await sql`
    INSERT INTO memories (
      user_one,
      user_two,
      created_by,
      title,
      description,
      memory_date
    )
    VALUES (
      ${connection.user_one},
      ${connection.user_two},
      ${userId},
      ${title.trim()},
      ${description?.trim() || null},
      ${memory_date || null}
    )
    RETURNING
      id,
      user_one,
      user_two,
      created_by,
      title,
      description,
      memory_date,
      created_at,
      updated_at
  `;

				return Response.json(
					{
						message: 'Memory created successfully',
						memory: result[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * DREAM BOARD
			 * ==========================================
			 *
			 * GET /users/:clerkId/dreams
			 *
			 * Returns all dreams belonging to the
			 * current user's accepted relationship.
			 */

			const dreamsMatch = url.pathname.match(/^\/users\/([^/]+)\/dreams$/);

			if (dreamsMatch && request.method === 'GET') {
				const clerkId = dreamsMatch[1];

				// Find current user
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				// Find accepted connection
				const connectionResult = await sql`
    SELECT
      id,
      user_one,
      user_two
    FROM connections
    WHERE
      (user_one = ${userId} OR user_two = ${userId})
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const connection = connectionResult[0];

				// Get dreams for this couple
				const dreams = await sql`
    SELECT
      id,
      connection_id,
      created_by,
      title,
      category,
      description,
      target_date,
      is_completed,
      completed_at,
      created_at,
      updated_at
    FROM dreams
    WHERE connection_id = ${connection.id}
    ORDER BY
      is_completed ASC,
      target_date ASC NULLS LAST,
      created_at DESC
  `;

				return Response.json({
					dreams,
				});
			}

			/*
			 * CREATE DREAM
			 *
			 * POST /users/:clerkId/dreams
			 */

			if (dreamsMatch && request.method === 'POST') {
				const clerkId = dreamsMatch[1];

				const body = await request.json();

				const title = body?.title?.trim();
				const category = body?.category?.trim() || 'Other';
				const description = body?.description?.trim() || null;
				const targetDate = body?.target_date || null;

				if (!title) {
					return Response.json({ error: 'title is required' }, { status: 400 });
				}

				// Find current user
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				// Find accepted connection
				const connectionResult = await sql`
    SELECT
      id,
      user_one,
      user_two
    FROM connections
    WHERE
      (user_one = ${userId} OR user_two = ${userId})
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const connection = connectionResult[0];

				const result = await sql`
    INSERT INTO dreams (
      connection_id,
      created_by,
      title,
      category,
      description,
      target_date
    )
    VALUES (
      ${connection.id},
      ${userId},
      ${title},
      ${category},
      ${description},
      ${targetDate}
    )
    RETURNING
      id,
      connection_id,
      created_by,
      title,
      category,
      description,
      target_date,
      is_completed,
      completed_at,
      created_at,
      updated_at
  `;

				return Response.json(
					{
						dream: result[0],
					},
					{ status: 201 },
				);
			}
			/*
			 * ==========================================
			 * UPDATE DREAM
			 * ==========================================
			 *
			 * PUT /users/:clerkId/dreams/:dreamId
			 *
			 * Used for:
			 * - Editing a dream
			 * - Marking a dream complete
			 * - Marking a dream incomplete
			 */

			const updateDreamMatch = url.pathname.match(/^\/users\/([^/]+)\/dreams\/([^/]+)$/);

			if (updateDreamMatch && request.method === 'PUT') {
				const clerkId = updateDreamMatch[1];
				const dreamId = updateDreamMatch[2];

				const body = await request.json();

				const title = body?.title !== undefined ? String(body.title).trim() : null;

				const category = body?.category !== undefined ? String(body.category).trim() : null;

				const description = body?.description !== undefined ? String(body.description).trim() : null;

				const targetDate = body?.target_date !== undefined ? body.target_date : null;

				const isCompleted = body?.is_completed !== undefined ? Boolean(body.is_completed) : null;

				/*
				 * Find current user
				 */
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				/*
				 * Make sure the dream exists
				 */
				const dreamResult = await sql`
    SELECT
      id,
      connection_id,
      created_by,
      title,
      category,
      description,
      target_date,
      is_completed,
      completed_at
    FROM dreams
    WHERE id = ${dreamId}
    LIMIT 1
  `;

				if (dreamResult.length === 0) {
					return Response.json({ error: 'Dream not found' }, { status: 404 });
				}

				const dream = dreamResult[0];

				/*
				 * Make sure the current user belongs
				 * to the relationship that owns the dream.
				 */
				const connectionResult = await sql`
    SELECT id
    FROM connections
    WHERE
      id = ${dream.connection_id}
      AND (user_one = ${userId} OR user_two = ${userId})
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not allowed to modify this dream.',
						},
						{ status: 403 },
					);
				}

				/*
				 * Only change fields that were supplied.
				 */
				const newTitle = title !== null ? title : dream.title;

				const newCategory = category !== null ? category : dream.category;

				const newDescription = description !== null ? description || null : dream.description;

				const newTargetDate = targetDate !== null ? targetDate || null : dream.target_date;

				const newIsCompleted = isCompleted !== null ? isCompleted : dream.is_completed;

				/*
				 * Set completed_at automatically.
				 */
				let newCompletedAt = dream.completed_at;

				if (newIsCompleted && !dream.is_completed) {
					newCompletedAt = new Date().toISOString();
				}

				if (!newIsCompleted) {
					newCompletedAt = null;
				}

				const result = await sql`
    UPDATE dreams
    SET
      title = ${newTitle},
      category = ${newCategory},
      description = ${newDescription},
      target_date = ${newTargetDate},
      is_completed = ${newIsCompleted},
      completed_at = ${newCompletedAt},
      updated_at = NOW()
    WHERE id = ${dreamId}
    RETURNING
      id,
      connection_id,
      created_by,
      title,
      category,
      description,
      target_date,
      is_completed,
      completed_at,
      created_at,
      updated_at
  `;

				return Response.json({
					message: 'Dream updated successfully',
					dream: result[0],
				});
			}

			/*
			 * ==========================================
			 * DELETE DREAM
			 * ==========================================
			 *
			 * DELETE /users/:clerkId/dreams/:dreamId
			 */

			const deleteDreamMatch = url.pathname.match(/^\/users\/([^/]+)\/dreams\/([^/]+)$/);

			if (deleteDreamMatch && request.method === 'DELETE') {
				const clerkId = deleteDreamMatch[1];
				const dreamId = deleteDreamMatch[2];

				/*
				 * Find current user
				 */
				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				/*
				 * Find the dream and make sure the user
				 * belongs to its accepted connection.
				 */
				const dreamResult = await sql`
    SELECT
      id,
      connection_id
    FROM dreams
    WHERE id = ${dreamId}
    LIMIT 1
  `;

				if (dreamResult.length === 0) {
					return Response.json({ error: 'Dream not found' }, { status: 404 });
				}

				const dream = dreamResult[0];

				const connectionResult = await sql`
    SELECT id
    FROM connections
    WHERE
      id = ${dream.connection_id}
      AND (user_one = ${userId} OR user_two = ${userId})
      AND status = 'accepted'
    LIMIT 1
  `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not allowed to delete this dream.',
						},
						{ status: 403 },
					);
				}

				await sql`
    DELETE FROM dreams
    WHERE id = ${dreamId}
  `;

				return Response.json({
					message: 'Dream deleted successfully',
				});
			}
			/*
			 * ==========================================
			 * UPDATE PROFILE
			 * ==========================================
			 *
			 * PUT /users/:clerkId/profile
			 */

			const updateProfileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);

			if (updateProfileMatch && request.method === 'PUT') {
				const clerkId = updateProfileMatch[1];

				const body = await request.json();

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				const existingResult = await sql`
    SELECT
      first_name,
      last_name,
      birthday,
      gender,
      country,
      relationship_status
    FROM profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `;

				if (existingResult.length === 0) {
					return Response.json(
						{
							error: 'Profile not found',
						},
						{ status: 404 },
					);
				}

				const existing = existingResult[0];

				/*
				 * Only overwrite fields that were actually sent.
				 *
				 * Anything left out of the request keeps its current
				 * value, so a partial update (e.g. saving just the
				 * name from the edit screen) can't wipe the rest of
				 * the profile.
				 */
				const readText = (value, current) => (value !== undefined ? String(value).trim() || null : current);

				const firstName = readText(body?.first_name, existing.first_name);
				const lastName = readText(body?.last_name, existing.last_name);
				const gender = readText(body?.gender, existing.gender);
				const country = readText(body?.country, existing.country);
				const relationshipStatus = readText(body?.relationship_status, existing.relationship_status);

				let birthday = existing.birthday;

				if (body?.birthday !== undefined) {
					const normalizedBirthday = body.birthday ? String(body.birthday).trim() : '';

					const profileBirthdayProblem = normalizedBirthday ? birthdayProblem(normalizedBirthday) : null;

					if (profileBirthdayProblem) {
						return Response.json(
							{
								error: profileBirthdayProblem,
							},
							{ status: 400 },
						);
					}

					birthday = normalizedBirthday || null;
				}

				const profileResult = await sql`
    UPDATE profiles
    SET
      first_name = ${firstName},
      last_name = ${lastName},
      birthday = ${birthday},
      gender = ${gender},
      country = ${country},
      relationship_status = ${relationshipStatus}
    WHERE user_id = ${userId}
    RETURNING *
  `;

				if (profileResult.length === 0) {
					return Response.json(
						{
							error: 'Profile not found',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					message: 'Profile updated successfully',
					profile: profileResult[0],
				});
			}
			/*
			 * ==========================================
			 * COUPLE TRIVIA
			 * ==========================================
			 *
			 * GET  /users/:clerkId/trivia
			 * POST /users/:clerkId/trivia/answer
			 */

			/*
			 * Build exactly 4 unique answer options.
			 *
			 * The correct answer is always included.
			 * Duplicate answers are removed.
			 * Options are shuffled before being sent to the app.
			 */
			const buildTriviaOptions = (correctAnswer, distractors = []) => {
				const correct = String(correctAnswer).trim();

				const uniqueOptions = [];

				const addOption = (value) => {
					if (!value) return;

					const cleaned = String(value).trim();

					if (!cleaned) return;

					const alreadyExists = uniqueOptions.some((option) => option.toLowerCase() === cleaned.toLowerCase());

					if (!alreadyExists) {
						uniqueOptions.push(cleaned);
					}
				};

				addOption(correct);

				for (const distractor of distractors) {
					addOption(distractor);

					if (uniqueOptions.length === 4) {
						break;
					}
				}

				return uniqueOptions.sort(() => Math.random() - 0.5).slice(0, 4);
			};

			/*
			 * GET TRIVIA QUESTIONS
			 */

			const triviaMatch = url.pathname.match(/^\/users\/([^/]+)\/trivia$/);

			if (triviaMatch && request.method === 'GET') {
				const clerkId = triviaMatch[1];

				const userResult = await sql`
        SELECT id
        FROM users
        WHERE clerk_id = ${clerkId}
        LIMIT 1
    `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
        SELECT
            id,
            user_one,
            user_two
        FROM connections
        WHERE
            (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
        LIMIT 1
    `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not connected to anyone yet.',
						},
						{ status: 404 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				const partnerResult = await sql`
        SELECT
            p.first_name,
            p.birthday,
            pr.favorite_food,
            pr.favorite_snack,
            pr.favorite_drink,
            pr.favorite_color,
            pr.movie_genre,
            pr.music_genre,
            pr.communication_frequency,
            pr.affection_style,
            pr.love_languages,
            ri.personality_type,
            ri.conflict_style,
            ri.focus_areas
        FROM users u
        LEFT JOIN profiles p
            ON p.user_id = u.id
        LEFT JOIN preferences pr
            ON pr.user_id = u.id
        LEFT JOIN relationship_insights ri
            ON ri.user_id = u.id
        WHERE u.id = ${partnerId}
        LIMIT 1
    `;

				if (partnerResult.length === 0) {
					return Response.json(
						{
							error: 'Partner information not found.',
						},
						{ status: 404 },
					);
				}

				const partner = partnerResult[0];

				const partnerName = partner.first_name?.trim() || 'your partner';

				const questionPool = [];

				/*
				 * FAVORITE FOOD
				 */
				if (partner.favorite_food) {
					questionPool.push({
						id: 'favorite_food',
						question: `What is ${partnerName}'s favorite food?`,
						answer: partner.favorite_food,
						options: buildTriviaOptions(partner.favorite_food, ['Rice', 'Pizza', 'Pasta', 'Chicken', 'Fries', 'Burger']),
					});
				}

				/*
				 * FAVORITE SNACK
				 */
				if (partner.favorite_snack) {
					questionPool.push({
						id: 'favorite_snack',
						question: `What is ${partnerName}'s favorite snack?`,
						answer: partner.favorite_snack,
						options: buildTriviaOptions(partner.favorite_snack, ['Chips', 'Biscuits', 'Chocolate', 'Popcorn', 'Cookies', 'Cake']),
					});
				}

				/*
				 * FAVORITE DRINK
				 */
				if (partner.favorite_drink) {
					questionPool.push({
						id: 'favorite_drink',
						question: `What is ${partnerName}'s favorite drink?`,
						answer: partner.favorite_drink,
						options: buildTriviaOptions(partner.favorite_drink, ['Coca-Cola', 'Water', 'Juice', 'Tea', 'Coffee', 'Lemonade']),
					});
				}

				/*
				 * FAVORITE COLOR
				 */
				if (partner.favorite_color) {
					questionPool.push({
						id: 'favorite_color',
						question: `What is ${partnerName}'s favorite color?`,
						answer: partner.favorite_color,
						options: buildTriviaOptions(partner.favorite_color, ['Blue', 'White', 'Red', 'Green', 'Purple', 'Pink', 'Yellow']),
					});
				}

				/*
				 * MOVIE GENRE
				 */
				if (partner.movie_genre) {
					questionPool.push({
						id: 'movie_genre',
						question: `What type of movies does ${partnerName} enjoy most?`,
						answer: partner.movie_genre,
						options: buildTriviaOptions(partner.movie_genre, ['Action', 'Comedy', 'Drama', 'Romance', 'Thriller', 'Horror', 'Documentary']),
					});
				}

				/*
				 * MUSIC GENRE
				 */
				if (partner.music_genre) {
					questionPool.push({
						id: 'music_genre',
						question: `What type of music does ${partnerName} enjoy most?`,
						answer: partner.music_genre,
						options: buildTriviaOptions(partner.music_genre, ['Afrobeats', 'Gospel', 'R&B', 'Pop', 'Hip-Hop', 'Jazz', 'Rock']),
					});
				}

				/*
				 * COMMUNICATION
				 */
				if (partner.communication_frequency) {
					questionPool.push({
						id: 'communication_frequency',
						question: `How does ${partnerName} prefer to communicate?`,
						answer: partner.communication_frequency,
						options: buildTriviaOptions(partner.communication_frequency, [
							'Text',
							'Phone calls',
							'In person',
							'Video calls',
							'Voice notes',
							'Social media',
						]),
					});
				}

				/*
				 * AFFECTION STYLE
				 */
				if (partner.affection_style) {
					questionPool.push({
						id: 'affection_style',
						question: `How does ${partnerName} usually show affection?`,
						answer: partner.affection_style,
						options: buildTriviaOptions(partner.affection_style, [
							'Words',
							'Actions',
							'Physical affection',
							'Quality time',
							'Thoughtful gifts',
							'Acts of service',
						]),
					});
				}

				/*
				 * LOVE LANGUAGE
				 *
				 * IMPORTANT:
				 * Always use the FIRST saved love language as the
				 * correct answer. This keeps GET and POST consistent.
				 */
				if (Array.isArray(partner.love_languages) && partner.love_languages.length > 0) {
					const correctLoveLanguage = partner.love_languages[0];

					questionPool.push({
						id: 'love_language',
						question: `Which of these is one of ${partnerName}'s love languages?`,
						answer: correctLoveLanguage,
						options: buildTriviaOptions(correctLoveLanguage, [
							'Quality Time',
							'Receiving Gifts',
							'Acts of Service',
							'Words of Affirmation',
							'Physical Touch',
						]),
					});
				}

				/*
				 * PERSONALITY
				 */
				if (partner.personality_type) {
					questionPool.push({
						id: 'personality_type',
						question: `What best describes ${partnerName}'s personality?`,
						answer: partner.personality_type,
						options: buildTriviaOptions(partner.personality_type, ['Extrovert', 'Ambivert', 'Introvert', 'Reserved', 'Outgoing']),
					});
				}

				/*
				 * CONFLICT STYLE
				 */
				if (partner.conflict_style) {
					questionPool.push({
						id: 'conflict_style',
						question: `When there is conflict, what does ${partnerName} prefer?`,
						answer: partner.conflict_style,
						options: buildTriviaOptions(partner.conflict_style, [
							'Need time to think',
							'Need reassurance',
							'Talk immediately',
							'Take some space',
							'Talk it through calmly',
						]),
					});
				}

				/*
				 * FOCUS AREA
				 *
				 * IMPORTANT:
				 * Always use the FIRST saved focus area as the correct answer.
				 */
				if (Array.isArray(partner.focus_areas) && partner.focus_areas.length > 0) {
					const correctFocusArea = partner.focus_areas[0];

					questionPool.push({
						id: 'focus_area',
						question: `Which of these is something ${partnerName} wants Between Us to help with?`,
						answer: correctFocusArea,
						options: buildTriviaOptions(correctFocusArea, [
							'Date Ideas',
							'Gift Ideas',
							'Better Communication',
							'More Quality Time',
							'Try New Things Together',
							'Create Memories',
						]),
					});
				}

				/*
				 * Make sure we have enough questions.
				 */
				if (questionPool.length < 2) {
					return Response.json(
						{
							error: 'Not enough partner information to create trivia questions.',
						},
						{ status: 400 },
					);
				}

				/*
				 * Pick 2 random questions.
				 */
				const shuffledQuestions = [...questionPool].sort(() => Math.random() - 0.5);

				const selectedQuestions = shuffledQuestions.slice(0, 2).map((item, index) => ({
					question_number: index + 1,
					id: item.id,
					question: item.question,
					options: item.options,
				}));

				return Response.json({
					partner: {
						first_name: partnerName,
					},
					total_questions: selectedQuestions.length,
					questions: selectedQuestions,
				});
			}

			/*
			 * POST TRIVIA ANSWER
			 */

			const triviaAnswerMatch = url.pathname.match(/^\/users\/([^/]+)\/trivia\/answer$/);

			if (triviaAnswerMatch && request.method === 'POST') {
				const clerkId = triviaAnswerMatch[1];

				const body = await request.json();

				const questionId = body?.question_id;
				const selectedAnswer = body?.answer;

				if (!questionId || !selectedAnswer) {
					return Response.json(
						{
							error: 'question_id and answer are required.',
						},
						{ status: 400 },
					);
				}

				const userResult = await sql`
        SELECT id
        FROM users
        WHERE clerk_id = ${clerkId}
        LIMIT 1
    `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
        SELECT
            user_one,
            user_two
        FROM connections
        WHERE
            (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
        LIMIT 1
    `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not connected to anyone yet.',
						},
						{ status: 404 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				/*
				 * Get partner information again.
				 * Answers are always checked on the server.
				 */
				const partnerResult = await sql`
        SELECT
            p.first_name,
            pr.favorite_food,
            pr.favorite_snack,
            pr.favorite_drink,
            pr.favorite_color,
            pr.movie_genre,
            pr.music_genre,
            pr.communication_frequency,
            pr.affection_style,
            pr.love_languages,
            ri.personality_type,
            ri.conflict_style,
            ri.focus_areas
        FROM users u
        LEFT JOIN profiles p
            ON p.user_id = u.id
        LEFT JOIN preferences pr
            ON pr.user_id = u.id
        LEFT JOIN relationship_insights ri
            ON ri.user_id = u.id
        WHERE u.id = ${partnerId}
        LIMIT 1
    `;

				if (partnerResult.length === 0) {
					return Response.json(
						{
							error: 'Partner information not found.',
						},
						{ status: 404 },
					);
				}

				const partner = partnerResult[0];

				let correctAnswer = null;

				switch (questionId) {
					case 'favorite_food':
						correctAnswer = partner.favorite_food;
						break;

					case 'favorite_snack':
						correctAnswer = partner.favorite_snack;
						break;

					case 'favorite_drink':
						correctAnswer = partner.favorite_drink;
						break;

					case 'favorite_color':
						correctAnswer = partner.favorite_color;
						break;

					case 'movie_genre':
						correctAnswer = partner.movie_genre;
						break;

					case 'music_genre':
						correctAnswer = partner.music_genre;
						break;

					case 'communication_frequency':
						correctAnswer = partner.communication_frequency;
						break;

					case 'affection_style':
						correctAnswer = partner.affection_style;
						break;

					case 'personality_type':
						correctAnswer = partner.personality_type;
						break;

					case 'conflict_style':
						correctAnswer = partner.conflict_style;
						break;

					case 'love_language':
						if (Array.isArray(partner.love_languages) && partner.love_languages.length > 0) {
							/*
							 * Must match the GET endpoint.
							 */
							correctAnswer = partner.love_languages[0];
						}
						break;

					case 'focus_area':
						if (Array.isArray(partner.focus_areas) && partner.focus_areas.length > 0) {
							/*
							 * Must match the GET endpoint.
							 */
							correctAnswer = partner.focus_areas[0];
						}
						break;

					default:
						return Response.json(
							{
								error: 'Invalid question.',
							},
							{ status: 400 },
						);
				}

				if (!correctAnswer) {
					return Response.json(
						{
							error: 'The answer for this question is unavailable.',
						},
						{ status: 400 },
					);
				}

				const isCorrect = String(selectedAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

				return Response.json({
					correct: isCorrect,
					correct_answer: correctAnswer,
				});
			}

			/*
			 * ==========================================
			 * COMPLETE TRIVIA ROUND
			 * ==========================================
			 *
			 * POST /users/:clerkId/trivia/complete
			 *
			 * Records the finished round so the scheduled
			 * job knows this couple actually played, and
			 * lets the partner know right away.
			 */

			const triviaCompleteMatch = url.pathname.match(/^\/users\/([^/]+)\/trivia\/complete$/);

			if (triviaCompleteMatch && request.method === 'POST') {
				const clerkId = triviaCompleteMatch[1];

				const body = await request.json();

				const score = Number.isInteger(body?.score) ? body.score : null;
				const totalQuestions = Number.isInteger(body?.total_questions) ? body.total_questions : null;

				if (score === null || totalQuestions === null) {
					return Response.json({ error: 'score and total_questions are required.' }, { status: 400 });
				}

				const userResult = await sql`
        SELECT id
        FROM users
        WHERE clerk_id = ${clerkId}
        LIMIT 1
    `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
        SELECT
            id,
            user_one,
            user_two
        FROM connections
        WHERE
            (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
        LIMIT 1
    `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				const result = await sql`
        INSERT INTO trivia_sessions (
            connection_id,
            user_id,
            score,
            total_questions
        )
        VALUES (
            ${connection.id},
            ${userId},
            ${score},
            ${totalQuestions}
        )
        RETURNING
            id,
            connection_id,
            user_id,
            score,
            total_questions,
            completed_at
    `;

				const session = result[0];

				const playerResult = await sql`
        SELECT p.first_name, u.push_token
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = ${userId}
        LIMIT 1
    `;

				const partnerPushResult = await sql`
        SELECT push_token, notification_preferences
        FROM users
        WHERE id = ${partnerId}
        LIMIT 1
    `;

				const playerName = playerResult[0]?.first_name?.trim() || 'Your partner';
				const partnerPushToken = partnerPushResult[0]?.push_token;

				await notifyUser(sql, {
					userId: partnerId,
					pushToken: partnerPushToken,
					preferences: partnerPushResult[0]?.notification_preferences,
					type: 'trivia_played',
					title: 'Trivia round completed',
					message: `${playerName} just played couple trivia and scored ${score}/${totalQuestions}. Your turn!`,
					dedupeKey: `trivia_played:${session.id}`,
					data: { sessionId: session.id },
				});

				return Response.json(
					{
						message: 'Trivia round recorded',
						session,
					},
					{ status: 201 },
				);
			}

			/*
			 * ==========================================
			 * TRIVIA HISTORY
			 * ==========================================
			 *
			 * GET /users/:clerkId/trivia/history
			 *
			 * Every round either person in the connection
			 * has played, newest first.
			 */

			const triviaHistoryMatch = url.pathname.match(/^\/users\/([^/]+)\/trivia\/history$/);

			if (triviaHistoryMatch && request.method === 'GET') {
				const clerkId = triviaHistoryMatch[1];

				const userResult = await sql`
        SELECT id
        FROM users
        WHERE clerk_id = ${clerkId}
        LIMIT 1
    `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
        SELECT id
        FROM connections
        WHERE
            (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
        LIMIT 1
    `;

				if (connectionResult.length === 0) {
					return Response.json({ sessions: [], stats: null });
				}

				const sessions = await sql`
        SELECT
            ts.id,
            ts.user_id,
            ts.score,
            ts.total_questions,
            ts.completed_at,
            p.first_name AS player_first_name
        FROM trivia_sessions ts
        LEFT JOIN profiles p
            ON p.user_id = ts.user_id
        WHERE ts.connection_id = ${connectionResult[0].id}
        ORDER BY ts.completed_at DESC
        LIMIT 50
    `;

				const yourSessions = sessions.filter((session) => session.user_id === userId);

				const totalAnswered = yourSessions.reduce((sum, session) => sum + session.total_questions, 0);

				const totalCorrect = yourSessions.reduce((sum, session) => sum + session.score, 0);

				return Response.json({
					sessions: sessions.map((session) => ({
						...session,
						is_you: session.user_id === userId,
					})),
					stats: {
						rounds_played: yourSessions.length,
						best_score: yourSessions.reduce((best, session) => Math.max(best, session.score), 0),
						accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null,
					},
				});
			}

			/*
			 * ==========================================
			 * REMINDER INTELLIGENCE
			 * ==========================================
			 *
			 * GET /users/:clerkId/reminders
			 *
			 * Generates personalized relationship reminders
			 * from birthdays, dreams, memories and connection data.
			 */

			const remindersMatch = url.pathname.match(/^\/users\/([^/]+)\/reminders$/);

			if (remindersMatch && request.method === 'GET') {
				const clerkId = remindersMatch[1];

				/*
				 * Find current user
				 */
				const userResult = await sql`
		SELECT id
		FROM users
		WHERE clerk_id = ${clerkId}
		LIMIT 1
	`;

				if (userResult.length === 0) {
					return Response.json(
						{
							error: 'User not found',
						},
						{ status: 404 },
					);
				}

				const userId = userResult[0].id;

				/*
				 * Find accepted connection
				 */
				const connectionResult = await sql`
		SELECT
			id,
			user_one,
			user_two,
			connected_at
		FROM connections
		WHERE
			(user_one = ${userId} OR user_two = ${userId})
			AND status = 'accepted'
		LIMIT 1
	`;

				if (connectionResult.length === 0) {
					return Response.json({
						reminders: [],
					});
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				/*
				 * Get partner profile
				 */
				const partnerResult = await sql`
		SELECT
			first_name,
			birthday
		FROM profiles
		WHERE user_id = ${partnerId}
		LIMIT 1
	`;

				const partner = partnerResult[0] || {};

				const partnerName = partner.first_name?.trim() || 'your partner';

				const reminders = [];

				const today = new Date();

				/*
				 * ==========================================
				 * 1. BIRTHDAY REMINDER
				 * ==========================================
				 */

				if (partner.birthday) {
					const birthday = new Date(partner.birthday);

					let nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

					if (nextBirthday < today) {
						nextBirthday = new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
					}

					const millisecondsPerDay = 1000 * 60 * 60 * 24;

					const daysUntilBirthday = Math.ceil((nextBirthday - today) / millisecondsPerDay);

					if (daysUntilBirthday <= 30) {
						reminders.push({
							type: 'birthday',
							priority: daysUntilBirthday <= 7 ? 'high' : 'medium',
							title: `${partnerName}'s birthday is coming up`,
							message:
								daysUntilBirthday === 0
									? `Today is ${partnerName}'s birthday.`
									: `${partnerName}'s birthday is in ${daysUntilBirthday} day${
											daysUntilBirthday === 1 ? '' : 's'
										}. Start planning something special.`,
						});
					}
				}

				/*
				 * ==========================================
				 * 2. UPCOMING DREAM
				 * ==========================================
				 */

				const upcomingDreams = await sql`
		SELECT
			id,
			title,
			target_date
		FROM dreams
		WHERE
			connection_id = ${connection.id}
			AND is_completed = false
			AND target_date IS NOT NULL
			AND target_date >= CURRENT_DATE
		ORDER BY target_date ASC
		LIMIT 3
	`;

				for (const dream of upcomingDreams) {
					const dreamDate = new Date(dream.target_date);

					const millisecondsPerDay = 1000 * 60 * 60 * 24;

					const daysUntilDream = Math.ceil((dreamDate - today) / millisecondsPerDay);

					if (daysUntilDream <= 14) {
						reminders.push({
							type: 'dream',
							priority: daysUntilDream <= 3 ? 'high' : 'medium',
							title: `Your dream is coming up`,
							message:
								daysUntilDream === 0
									? `"${dream.title}" is scheduled for today.`
									: `"${dream.title}" is coming up in ${daysUntilDream} day${daysUntilDream === 1 ? '' : 's'}.`,
						});
					}
				}

				/*
				 * ==========================================
				 * 3. OVERDUE DREAM
				 * ==========================================
				 */

				const overdueDreams = await sql`
		SELECT
			id,
			title,
			target_date
		FROM dreams
		WHERE
			connection_id = ${connection.id}
			AND is_completed = false
			AND target_date IS NOT NULL
			AND target_date < CURRENT_DATE
		ORDER BY target_date ASC
		LIMIT 3
	`;

				for (const dream of overdueDreams) {
					reminders.push({
						type: 'dream_overdue',
						priority: 'high',
						title: `A shared dream needs attention`,
						message: `"${dream.title}" has passed its target date. Maybe check in with ${partnerName} about it.`,
					});
				}

				/*
				 * ==========================================
				 * 5. RELATIONSHIP ANNIVERSARY
				 * ==========================================
				 */

				if (connection.connected_at) {
					const connectedDate = new Date(connection.connected_at);

					const anniversary = new Date(today.getFullYear(), connectedDate.getMonth(), connectedDate.getDate());

					/*
					 * If this year's anniversary has already passed,
					 * use next year's anniversary.
					 */
					if (anniversary < today) {
						anniversary.setFullYear(today.getFullYear() + 1);
					}

					/*
					 * Do not remind someone about an anniversary
					 * before the first full year together.
					 */
					const firstAnniversary = new Date(connectedDate);
					firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

					if (anniversary < firstAnniversary) {
						anniversary.setTime(firstAnniversary.getTime());
					}

					const millisecondsPerDay = 1000 * 60 * 60 * 24;

					const daysUntilAnniversary = Math.ceil((anniversary - today) / millisecondsPerDay);

					if (daysUntilAnniversary <= 30) {
						reminders.push({
							type: 'anniversary',
							priority: daysUntilAnniversary <= 7 ? 'high' : 'medium',
							title: 'Your relationship anniversary is coming up',
							message:
								daysUntilAnniversary === 0
									? `Today marks another year since you and ${partnerName} connected.`
									: `Your relationship anniversary is in ${daysUntilAnniversary} day${daysUntilAnniversary === 1 ? '' : 's'}.`,
						});
					}
				}

				/*
				 * ==========================================
				 * SORT REMINDERS
				 * ==========================================
				 */

				const priorityOrder = {
					high: 1,
					medium: 2,
					low: 3,
				};

				reminders.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

				return Response.json({
					reminders,
					total: reminders.length,
				});
			}

			/*
			 * ==========================================
			 * NOTIFICATIONS
			 * ==========================================
			 *
			 * GET /users/:clerkId/notifications
			 */

			const notificationsMatch = url.pathname.match(/^\/users\/([^/]+)\/notifications$/);

			if (notificationsMatch && request.method === 'GET') {
				const clerkId = notificationsMatch[1];

				const userResult = await sql`
    SELECT id
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const notifications = await sql`
    SELECT
      id,
      type,
      title,
      message,
      is_read,
      created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

				return Response.json({
					notifications,
				});
			}

			/*
			 * ==========================================
			 * MARK NOTIFICATION AS READ
			 * ==========================================
			 *
			 * PATCH /users/:clerkId/notifications/:notificationId
			 */

			const notificationReadMatch = url.pathname.match(/^\/users\/([^/]+)\/notifications\/([^/]+)$/);

			if (notificationReadMatch && request.method === 'PATCH') {
				const clerkId = notificationReadMatch[1];
				const notificationId = notificationReadMatch[2];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const result = await sql`
          UPDATE notifications
          SET is_read = true
          WHERE id = ${notificationId}
            AND user_id = ${userId}
          RETURNING
            id,
            type,
            title,
            message,
            is_read,
            created_at
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Notification not found',
						},
						{ status: 404 },
					);
				}

				return Response.json({
					notification: result[0],
				});
			}

			/*
			 * ==========================================
			 * HEARTBEAT
			 * ==========================================
			 *
			 * POST /users/:clerkId/heartbeat
			 *
			 * Called by the app on launch/foreground so the
			 * scheduled job can tell who has gone inactive.
			 */

			const heartbeatMatch = url.pathname.match(/^\/users\/([^/]+)\/heartbeat$/);

			if (heartbeatMatch && request.method === 'POST') {
				const clerkId = heartbeatMatch[1];

				const result = await sql`
          UPDATE users
          SET last_active_at = NOW()
          WHERE clerk_id = ${clerkId}
          RETURNING
            id,
            clerk_id,
            last_active_at
        `;

				if (result.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				return Response.json({
					message: 'Heartbeat recorded',
					user: result[0],
				});
			}

			/*
			 * ==========================================
			 * NOTIFICATION PREFERENCES
			 * ==========================================
			 *
			 * GET /users/:clerkId/notification-preferences
			 * PUT /users/:clerkId/notification-preferences
			 *
			 * Only explicit opt-outs are stored, so an empty
			 * object means every notification type is on.
			 */

			const notificationPreferencesMatch = url.pathname.match(/^\/users\/([^/]+)\/notification-preferences$/);

			if (notificationPreferencesMatch && request.method === 'GET') {
				const clerkId = notificationPreferencesMatch[1];

				const result = await sql`
          SELECT notification_preferences
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (result.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				return Response.json({
					preferences: result[0].notification_preferences || {},
				});
			}

			if (notificationPreferencesMatch && request.method === 'PUT') {
				const clerkId = notificationPreferencesMatch[1];

				const body = await request.json();

				const incoming = body?.preferences;

				if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
					return Response.json({ error: 'preferences must be an object' }, { status: 400 });
				}

				const existingResult = await sql`
          SELECT notification_preferences
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (existingResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const merged = { ...(existingResult[0].notification_preferences || {}) };

				/*
				 * Keep only real opt-outs. Turning something back
				 * on removes the key rather than storing `true`,
				 * so the stored object stays small and "missing
				 * means enabled" holds.
				 */
				for (const [type, enabled] of Object.entries(incoming)) {
					if (enabled === false) {
						merged[type] = false;
					} else {
						delete merged[type];
					}
				}

				const result = await sql`
          UPDATE users
          SET notification_preferences = ${JSON.stringify(merged)}::jsonb
          WHERE clerk_id = ${clerkId}
          RETURNING notification_preferences
        `;

				return Response.json({
					message: 'Notification preferences saved',
					preferences: result[0].notification_preferences || {},
				});
			}

			/*
			 * ==========================================
			 * SPECIAL DATES
			 * ==========================================
			 *
			 * GET    /users/:clerkId/special-dates
			 * POST   /users/:clerkId/special-dates
			 * DELETE /users/:clerkId/special-dates/:id
			 *
			 * Owned by one user, but the scheduled job
			 * notifies that user's partner as well.
			 */

			const specialDatesMatch = url.pathname.match(/^\/users\/([^/]+)\/special-dates$/);

			if (specialDatesMatch && request.method === 'GET') {
				const clerkId = specialDatesMatch[1];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const specialDates = await sql`
          SELECT
            id,
            user_id,
            title,
            event_date
          FROM special_dates
          WHERE user_id = ${userId}
          ORDER BY event_date ASC
        `;

				return Response.json({ special_dates: specialDates });
			}

			if (specialDatesMatch && request.method === 'POST') {
				const clerkId = specialDatesMatch[1];

				const body = await request.json();

				const title = body?.title?.trim();
				const eventDate = body?.event_date;

				if (!title || !eventDate) {
					return Response.json({ error: 'title and event_date are required' }, { status: 400 });
				}

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				/*
				 * Special dates are shared with a partner, so
				 * they cannot be added until you have one.
				 */
				const linked = await sql`
          SELECT id
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (linked.length === 0) {
					return Response.json({ error: 'Connect with your partner first.' }, { status: 403 });
				}

				const result = await sql`
          INSERT INTO special_dates (
            user_id,
            title,
            event_date
          )
          VALUES (
            ${userId},
            ${title},
            ${eventDate}
          )
          RETURNING
            id,
            user_id,
            title,
            event_date
        `;

				return Response.json(
					{
						message: 'Special date created',
						special_date: result[0],
					},
					{ status: 201 },
				);
			}

			const deleteSpecialDateMatch = url.pathname.match(/^\/users\/([^/]+)\/special-dates\/([^/]+)$/);

			if (deleteSpecialDateMatch && request.method === 'DELETE') {
				const clerkId = deleteSpecialDateMatch[1];
				const specialDateId = deleteSpecialDateMatch[2];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const result = await sql`
          DELETE FROM special_dates
          WHERE id = ${specialDateId}
            AND user_id = ${userId}
          RETURNING id
        `;

				if (result.length === 0) {
					return Response.json({ error: 'Special date not found' }, { status: 404 });
				}

				return Response.json({ message: 'Special date deleted' });
			}

			/*
			 * ==========================================
			 * RELATIONSHIP GOALS
			 * ==========================================
			 *
			 * GET    /users/:clerkId/relationship-goals
			 * POST   /users/:clerkId/relationship-goals
			 * PUT    /users/:clerkId/relationship-goals/:goalId
			 * DELETE /users/:clerkId/relationship-goals/:goalId
			 *
			 * Shared by both people in an accepted connection,
			 * same ownership model as dreams.
			 */

			const goalsMatch = url.pathname.match(/^\/users\/([^/]+)\/relationship-goals$/);

			if (goalsMatch && request.method === 'GET') {
				const clerkId = goalsMatch[1];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
          SELECT id
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ goals: [] });
				}

				const goals = await sql`
          SELECT
            id,
            connection_id,
            created_by,
            title,
            description,
            target_date,
            status,
            completed_at,
            created_at,
            updated_at
          FROM relationship_goals
          WHERE connection_id = ${connectionResult[0].id}
          ORDER BY
            status ASC,
            target_date ASC NULLS LAST,
            created_at DESC
        `;

				return Response.json({ goals });
			}

			if (goalsMatch && request.method === 'POST') {
				const clerkId = goalsMatch[1];

				const body = await request.json();

				const title = body?.title?.trim();
				const description = body?.description?.trim() || null;
				const targetDate = body?.target_date || null;

				if (!title) {
					return Response.json({ error: 'title is required' }, { status: 400 });
				}

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const connectionResult = await sql`
          SELECT id
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const result = await sql`
          INSERT INTO relationship_goals (
            connection_id,
            created_by,
            title,
            description,
            target_date
          )
          VALUES (
            ${connectionResult[0].id},
            ${userId},
            ${title},
            ${description},
            ${targetDate}
          )
          RETURNING
            id,
            connection_id,
            created_by,
            title,
            description,
            target_date,
            status,
            completed_at,
            created_at,
            updated_at
        `;

				return Response.json({ goal: result[0] }, { status: 201 });
			}

			const updateGoalMatch = url.pathname.match(/^\/users\/([^/]+)\/relationship-goals\/([^/]+)$/);

			if (updateGoalMatch && request.method === 'PUT') {
				const clerkId = updateGoalMatch[1];
				const goalId = updateGoalMatch[2];

				const body = await request.json();

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const goalResult = await sql`
          SELECT id, connection_id, title, description, target_date, status, completed_at
          FROM relationship_goals
          WHERE id = ${goalId}
          LIMIT 1
        `;

				if (goalResult.length === 0) {
					return Response.json({ error: 'Goal not found' }, { status: 404 });
				}

				const goal = goalResult[0];

				const connectionResult = await sql`
          SELECT id
          FROM connections
          WHERE id = ${goal.connection_id}
            AND (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not allowed to modify this goal.' }, { status: 403 });
				}

				const newTitle = body?.title !== undefined ? String(body.title).trim() : goal.title;
				const newDescription = body?.description !== undefined ? String(body.description).trim() || null : goal.description;
				const newTargetDate = body?.target_date !== undefined ? body.target_date || null : goal.target_date;
				const newStatus = body?.status !== undefined ? body.status : goal.status;

				let newCompletedAt = goal.completed_at;

				if (newStatus === 'completed' && goal.status !== 'completed') {
					newCompletedAt = new Date().toISOString();
				}

				if (newStatus !== 'completed') {
					newCompletedAt = null;
				}

				const result = await sql`
          UPDATE relationship_goals
          SET
            title = ${newTitle},
            description = ${newDescription},
            target_date = ${newTargetDate},
            status = ${newStatus},
            completed_at = ${newCompletedAt},
            updated_at = NOW()
          WHERE id = ${goalId}
          RETURNING
            id,
            connection_id,
            created_by,
            title,
            description,
            target_date,
            status,
            completed_at,
            created_at,
            updated_at
        `;

				return Response.json({
					message: 'Goal updated successfully',
					goal: result[0],
				});
			}

			if (updateGoalMatch && request.method === 'DELETE') {
				const clerkId = updateGoalMatch[1];
				const goalId = updateGoalMatch[2];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				const goalResult = await sql`
          SELECT connection_id
          FROM relationship_goals
          WHERE id = ${goalId}
          LIMIT 1
        `;

				if (goalResult.length === 0) {
					return Response.json({ error: 'Goal not found' }, { status: 404 });
				}

				const connectionResult = await sql`
          SELECT id
          FROM connections
          WHERE id = ${goalResult[0].connection_id}
            AND (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not allowed to delete this goal.' }, { status: 403 });
				}

				await sql`
          DELETE FROM relationship_goals
          WHERE id = ${goalId}
        `;

				return Response.json({ message: 'Goal deleted successfully' });
			}

			/*
			 * ==========================================
			 * DAILY QUESTION
			 * ==========================================
			 *
			 * GET  /users/:clerkId/daily-question
			 * POST /users/:clerkId/daily-question
			 *
			 * One shared question per day. A partner's
			 * answer is withheld until you have written
			 * your own.
			 */

			const dailyQuestionMatch = url.pathname.match(/^\/users\/([^/]+)\/daily-question$/);

			if (dailyQuestionMatch && (request.method === 'GET' || request.method === 'POST')) {
				const clerkId = dailyQuestionMatch[1];

				const userResult = await sql`
          SELECT id
          FROM users
          WHERE clerk_id = ${clerkId}
          LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				await ensureSchema(sql);

				const today = new Date();
				const todayIso = today.toISOString().slice(0, 10);
				const question = questionForDate(today);

				const connectionResult = await sql`
          SELECT id, user_one, user_two
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json(
						{
							error: 'You are not connected to anyone yet.',
						},
						{ status: 404 },
					);
				}

				const connection = connectionResult[0];

				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				if (request.method === 'POST') {
					const body = await request.json();

					const answer = body?.answer?.trim();

					if (!answer) {
						return Response.json({ error: 'answer is required' }, { status: 400 });
					}

					await sql`
            INSERT INTO daily_answers (
              connection_id,
              user_id,
              question_date,
              question_key,
              answer
            )
            VALUES (
              ${connection.id},
              ${userId},
              ${todayIso},
              ${question.key},
              ${answer}
            )
            ON CONFLICT (user_id, question_date)
            DO UPDATE SET
              answer = EXCLUDED.answer,
              updated_at = NOW()
          `;

					/*
					 * Let the partner know there is something
					 * waiting for them to unlock.
					 */
					const partnerRow = await sql`
            SELECT u.push_token, u.notification_preferences, p.first_name
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = ${partnerId}
            LIMIT 1
          `;

					const meRow = await sql`
            SELECT first_name
            FROM profiles
            WHERE user_id = ${userId}
            LIMIT 1
          `;

					const myName = meRow[0]?.first_name?.trim() || 'Your partner';

					await notifyUser(sql, {
						userId: partnerId,
						pushToken: partnerRow[0]?.push_token,
						preferences: partnerRow[0]?.notification_preferences,
						type: 'daily_question_answered',
						title: `${myName} answered today's question`,
						message: 'Answer yours to see what they said.',
						dedupeKey: `daily_answered:${userId}:${todayIso}`,
					});
				}

				const answers = await sql`
          SELECT user_id, answer, updated_at
          FROM daily_answers
          WHERE question_date = ${todayIso}
            AND user_id IN (${userId}, ${partnerId})
        `;

				const mine = answers.find((row) => row.user_id === userId) || null;
				const theirs = answers.find((row) => row.user_id === partnerId) || null;

				const history = await sql`
          SELECT question_date
          FROM daily_answers
          WHERE user_id = ${userId}
          ORDER BY question_date DESC
          LIMIT 120
        `;

				const partnerProfile = await sql`
          SELECT first_name
          FROM profiles
          WHERE user_id = ${partnerId}
          LIMIT 1
        `;

				return Response.json({
					date: todayIso,
					question: question.text,
					question_key: question.key,
					your_answer: mine?.answer || null,
					/*
					 * Withheld on purpose until you answer.
					 */
					partner_answer: mine ? theirs?.answer || null : null,
					partner_answered: Boolean(theirs),
					partner_name: partnerProfile[0]?.first_name?.trim() || 'Your partner',
					streak: computeStreak(
						history.map((row) => row.question_date),
						todayIso,
					),
				});
			}

			/*
			 * ==========================================
			 * APPRECIATIONS
			 * ==========================================
			 *
			 * GET  /users/:clerkId/appreciations
			 * POST /users/:clerkId/appreciations
			 *
			 * Short notes of thanks, kept as a running
			 * list so a couple can look back at what the
			 * other actually noticed.
			 */

			const appreciationsMatch = url.pathname.match(/^\/users\/([^/]+)\/appreciations$/);

			if (appreciationsMatch && (request.method === 'GET' || request.method === 'POST')) {
				const clerkId = appreciationsMatch[1];

				const userResult = await sql`
          SELECT id FROM users WHERE clerk_id = ${clerkId} LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				await ensureSchema(sql);

				const connectionResult = await sql`
          SELECT id, user_one, user_two
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const connection = connectionResult[0];
				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;

				if (request.method === 'POST') {
					const body = await request.json();
					const message = body?.message?.trim();

					if (!message) {
						return Response.json({ error: 'message is required' }, { status: 400 });
					}

					await sql`
            INSERT INTO appreciations (
              connection_id, from_user_id, to_user_id, message
            )
            VALUES (
              ${connection.id}, ${userId}, ${partnerId}, ${message}
            )
          `;

					const partnerRow = await sql`
            SELECT u.push_token, u.notification_preferences
            FROM users u WHERE u.id = ${partnerId} LIMIT 1
          `;

					const meRow = await sql`
            SELECT first_name FROM profiles WHERE user_id = ${userId} LIMIT 1
          `;

					const myName = meRow[0]?.first_name?.trim() || 'Your partner';

					await notifyUser(sql, {
						userId: partnerId,
						pushToken: partnerRow[0]?.push_token,
						preferences: partnerRow[0]?.notification_preferences,
						type: 'appreciation',
						title: `${myName} appreciated something`,
						message,
						dedupeKey: `appreciation:${userId}:${Date.now()}`,
					});
				}

				const notes = await sql`
          SELECT
            a.id,
            a.from_user_id,
            a.to_user_id,
            a.message,
            a.created_at,
            p.first_name AS from_first_name
          FROM appreciations a
          LEFT JOIN profiles p ON p.user_id = a.from_user_id
          WHERE a.connection_id = ${connection.id}
          ORDER BY a.created_at DESC
          LIMIT 50
        `;

				return Response.json({
					appreciations: notes.map((row) => ({
						...row,
						mine: row.from_user_id === userId,
					})),
				});
			}

			/*
			 * ==========================================
			 * DELETE AN APPRECIATION
			 * ==========================================
			 *
			 * DELETE /users/:clerkId/appreciations/:id
			 *
			 * Only the person who wrote it can remove it.
			 * A note someone wrote about you is theirs to
			 * take back, not yours to erase.
			 */

			const deleteAppreciationMatch = url.pathname.match(/^\/users\/([^/]+)\/appreciations\/([^/]+)$/);

			if (deleteAppreciationMatch && request.method === 'DELETE') {
				const clerkId = deleteAppreciationMatch[1];
				const appreciationId = deleteAppreciationMatch[2];

				const userResult = await sql`
          SELECT id FROM users WHERE clerk_id = ${clerkId} LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				await ensureSchema(sql);

				const result = await sql`
          DELETE FROM appreciations
          WHERE id = ${appreciationId}
            AND from_user_id = ${userId}
          RETURNING id
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Note not found, or it is not yours to delete.',
						},
						{ status: 404 },
					);
				}

				return Response.json({ message: 'Appreciation deleted' });
			}

			/*
			 * ==========================================
			 * WEEKLY CHECK-IN
			 * ==========================================
			 *
			 * GET  /users/:clerkId/checkin
			 * POST /users/:clerkId/checkin
			 *
			 * How each person feels the relationship is
			 * going this week, plus enough history to show
			 * whether that is trending up or down.
			 */

			const checkinMatch = url.pathname.match(/^\/users\/([^/]+)\/checkin$/);

			if (checkinMatch && (request.method === 'GET' || request.method === 'POST')) {
				const clerkId = checkinMatch[1];

				const userResult = await sql`
          SELECT id FROM users WHERE clerk_id = ${clerkId} LIMIT 1
        `;

				if (userResult.length === 0) {
					return Response.json({ error: 'User not found' }, { status: 404 });
				}

				const userId = userResult[0].id;

				await ensureSchema(sql);

				const connectionResult = await sql`
          SELECT id, user_one, user_two
          FROM connections
          WHERE (user_one = ${userId} OR user_two = ${userId})
            AND status = 'accepted'
          LIMIT 1
        `;

				if (connectionResult.length === 0) {
					return Response.json({ error: 'You are not connected to anyone yet.' }, { status: 404 });
				}

				const connection = connectionResult[0];
				const partnerId = connection.user_one === userId ? connection.user_two : connection.user_one;
				const weekKey = isoWeekKey(new Date());

				if (request.method === 'POST') {
					const body = await request.json();
					const rating = Number(body?.rating);
					const note = body?.note?.trim() || null;

					if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
						return Response.json({ error: 'rating must be a whole number from 1 to 5' }, { status: 400 });
					}

					await sql`
            INSERT INTO checkins (
              connection_id, user_id, week_key, rating, note
            )
            VALUES (
              ${connection.id}, ${userId}, ${weekKey}, ${rating}, ${note}
            )
            ON CONFLICT (user_id, week_key)
            DO UPDATE SET
              rating = EXCLUDED.rating,
              note = EXCLUDED.note,
              updated_at = NOW()
          `;
				}

				const rows = await sql`
          SELECT user_id, week_key, rating, note, updated_at
          FROM checkins
          WHERE connection_id = ${connection.id}
          ORDER BY week_key DESC
          LIMIT 24
        `;

				const mine = rows.find((r) => r.user_id === userId && r.week_key === weekKey) || null;
				const theirs = rows.find((r) => r.user_id === partnerId && r.week_key === weekKey) || null;

				const partnerProfile = await sql`
          SELECT first_name FROM profiles WHERE user_id = ${partnerId} LIMIT 1
        `;

				return Response.json({
					week: weekKey,
					your_checkin: mine,
					partner_checkin: theirs,
					partner_name: partnerProfile[0]?.first_name?.trim() || 'Your partner',
					history: rows.map((r) => ({
						week: r.week_key,
						rating: r.rating,
						mine: r.user_id === userId,
					})),
				});
			}

			/*
			 * ==========================================
			 * ONBOARDING ANSWERS
			 * ==========================================
			 *
			 * GET /users/:clerkId/onboarding
			 *
			 * Returns what someone has already answered, keyed by
			 * the same ids the onboarding form uses. Resuming must
			 * start from these: saving onboarding overwrites every
			 * answer, so a blank form would wipe the earlier ones.
			 */

			const onboardingAnswersMatch = url.pathname.match(/^\/users\/([^/]+)\/onboarding$/);

			if (onboardingAnswersMatch && request.method === 'GET') {
				const clerkId = onboardingAnswersMatch[1];

				const rows = await sql`
          SELECT
            p.id AS profile_id,
            p.first_name,
            p.birthday,
            p.gender,
            p.country,
            p.relationship_status,
            pr.love_languages,
            pr.favorite_food,
            pr.favorite_snack,
            pr.favorite_drink,
            pr.favorite_color,
            pr.movie_genre,
            pr.music_genre,
            pr.communication_frequency,
            pr.affection_style,
            ri.personality_type,
            ri.conflict_style,
            ri.focus_areas
          FROM users u
          LEFT JOIN profiles p ON p.user_id = u.id
          LEFT JOIN preferences pr ON pr.user_id = u.id
          LEFT JOIN relationship_insights ri ON ri.user_id = u.id
          WHERE u.clerk_id = ${clerkId}
          LIMIT 1
        `;

				const row = rows[0];

				if (!row || !row.profile_id) {
					return Response.json({ exists: false, answers: {} });
				}

				const text = (value) => (value == null ? '' : String(value));
				const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

				return Response.json({
					exists: true,
					answers: {
						firstName: text(row.first_name),
						birthday: row.birthday ? toIsoDate(row.birthday) : '',
						gender: text(row.gender),
						country: text(row.country),
						relationshipStatus: text(row.relationship_status),
						personalityType: text(row.personality_type),
						communicationStyle: text(row.communication_frequency),
						conflictStyle: text(row.conflict_style),
						affectionStyle: text(row.affection_style),
						loveLanguages: list(row.love_languages),
						favoriteFood: text(row.favorite_food),
						favoriteSnack: text(row.favorite_snack),
						favoriteDrink: text(row.favorite_drink),
						favoriteColor: text(row.favorite_color),
						musicGenre: text(row.music_genre),
						movieGenre: text(row.movie_genre),
						focusAreas: list(row.focus_areas),
					},
				});
			}

			/*
			 * ==========================================
			 * NOT FOUND
			 * ==========================================
			 */

			return Response.json(
				{
					error: 'Not Found',
				},
				{ status: 404 },
			);
		} catch (error) {
			console.error('API ERROR:', error);

			return Response.json(
				{
					error: 'Database request failed',
					details: error?.message || 'Unknown error',
				},
				{ status: 500 },
			);
		}
	},
};
