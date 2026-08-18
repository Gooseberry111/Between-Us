import { neon } from '@neondatabase/serverless';

export default {
	async fetch(request, env) {
		try {
			const sql = neon(env.DATABASE_URL);
			const url = new URL(request.url);

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
			 * GET ALL USERS
			 * ==========================================
			 */

			if (url.pathname === '/users' && request.method === 'GET') {
				const users = await sql`
          SELECT
            id,
            clerk_id,
            email,
            created_at
          FROM users
          ORDER BY created_at DESC
        `;

				return Response.json(users);
			}

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
          SELECT id
          FROM users
          WHERE clerk_id = ${clerk_id}
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
			 * SAVE ONBOARDING
			 * ==========================================
			 *
			 * POST /onboarding
			 *
			 * Creates the user if necessary,
			 * then saves profile + preferences.
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
				} = body;

				if (!clerk_id || !email || !firstName || !birthday) {
					return Response.json(
						{
							error: 'clerk_id, email, firstName and birthday are required',
						},
						{ status: 400 },
					);
				}

				/*
				 * Find or create the user.
				 */

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

				/*
				 * Convert birthday to a proper PostgreSQL date.
				 *
				 * The app sends YYYY-MM-DD.
				 */

				const normalizedBirthday = String(birthday).trim();

				if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedBirthday)) {
					return Response.json(
						{
							error: 'Birthday must be in YYYY-MM-DD format',
						},
						{ status: 400 },
					);
				}

				/*
				 * Save profile.
				 */

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

				/*
				 * Save preferences.
				 */

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
      communication_frequency = EXCLUDED.communication_frequency,
      affection_style = EXCLUDED.affection_style
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
			 * GET USER PROFILE
			 * ==========================================
			 *
			 * /users/:clerkId/profile
			 */

			const profileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);

			if (profileMatch && request.method === 'GET') {
				const clerkId = profileMatch[1];

				const result = await sql`
          SELECT
            p.id,
            p.user_id,
            p.first_name,
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
			 *
			 * POST /users/:clerkId/profile
			 */

			const saveProfileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);

			if (saveProfileMatch && request.method === 'POST') {
				const clerkId = saveProfileMatch[1];

				const body = await request.json();

				const { firstName, birthday, gender, country, relationshipStatus } = body;

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
			 * GET /search?query=...&clerk_id=...
			 */

			if (url.pathname === '/search' && request.method === 'GET') {
				const query = url.searchParams.get('query');
				const clerkId = url.searchParams.get('clerk_id');

				if (!query || !clerkId) {
					return Response.json(
						{
							error: 'query and clerk_id are required',
						},
						{ status: 400 },
					);
				}

				/*
				 * Find the current user's database ID.
				 */

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

				/*
				 * Search for people who:
				 *
				 * 1. Have completed onboarding
				 * 2. Match the name or email
				 * 3. Are not the current user
				 * 4. Are not already connected
				 * 5. Don't already have a pending request
				 * 6. Aren't already connected to somebody else
				 */

				const results = await sql`
    SELECT
      u.id,
      u.clerk_id,
      u.email,
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
        OR u.email ILIKE ${'%' + query + '%'}
      )

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
      )

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

    ORDER BY
      p.first_name ASC

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
			 *
			 * Body:
			 *
			 * {
			 *   "from_clerk_id": "...",
			 *   "to_clerk_id": "...",
			 *   "relationship_type": "Dating"
			 * }
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

				/*
				 * Find both database users.
				 */

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
				 * Check whether either user already
				 * has an active/pending connection.
				 */

				const existing = await sql`
          SELECT
            id,
            user_one,
            user_two,
            relationship_type,
            status,
            created_at
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
				 * Check if sender is already connected
				 * to someone else.
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
				 * Check if receiver is already
				 * connected to someone else.
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
				 * Create request.
				 */

				const result = await sql`
          INSERT INTO connections (
            user_one,
            user_two,
            relationship_type,
            status
          )
          VALUES (
            ${sender.id},
            ${receiver.id},
            ${relationship_type},
            'pending'
          )
          RETURNING
            id,
            user_one,
            user_two,
            relationship_type,
            status,
            created_at
        `;

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
			 * GET CONNECTIONS FOR USER
			 * ==========================================
			 *
			 * GET
			 * /users/:clerkId/connections
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
            END AS other_first_name

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
			 * ACCEPT CONNECTION
			 * ==========================================
			 *
			 * POST /connections/:id/accept
			 */

			const acceptMatch = url.pathname.match(/^\/connections\/([^/]+)\/accept$/);

			if (acceptMatch && request.method === 'POST') {
				const connectionId = acceptMatch[1];

				const result = await sql`
          UPDATE connections
          SET status = 'accepted'
          WHERE
            id = ${connectionId}
            AND status = 'pending'
          RETURNING
            id,
            user_one,
            user_two,
            relationship_type,
            status,
            created_at
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection request not found',
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

				const result = await sql`
          UPDATE connections
          SET status = 'rejected'
          WHERE
            id = ${connectionId}
            AND status = 'pending'
          RETURNING
            id,
            user_one,
            user_two,
            relationship_type,
            status,
            created_at
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection request not found',
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
			 * DISCONNECT
			 * ==========================================
			 *
			 * DELETE /connections/:id
			 */

			const deleteMatch = url.pathname.match(/^\/connections\/([^/]+)$/);

			if (deleteMatch && request.method === 'DELETE') {
				const connectionId = deleteMatch[1];

				const result = await sql`
          DELETE FROM connections
          WHERE id = ${connectionId}
          RETURNING id
        `;

				if (result.length === 0) {
					return Response.json(
						{
							error: 'Connection not found',
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
			console.error(error);

			return Response.json(
				{
					error: 'Database request failed',
					details: error.message,
				},
				{ status: 500 },
			);
		}
	},
};
