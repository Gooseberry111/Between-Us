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
					goals,
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

				if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedBirthday)) {
					return Response.json(
						{
							error: 'Birthday must be in YYYY-MM-DD format',
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

				const insightGoals = Array.isArray(goals) ? goals.filter(Boolean) : [];

				await sql`
  DELETE FROM relationship_insights
  WHERE user_id = ${userId}
`;

				await sql`
  INSERT INTO relationship_insights (
    user_id,
    personality_type,
    conflict_style,
    goals
  )
  VALUES (
    ${userId},
    ${personalityType || null},
    ${conflictStyle || null},
    ${insightGoals}
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
      ri.goals,
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
  last_name = ${lastName},
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
							error: 'You can only edit memories you created.',
						},
						{ status: 403 },
					);
				}

				const updatedMemory = await sql`
    UPDATE memories
    SET
      title = ${body.title?.trim() || ''},
      description = ${body.description?.trim() || ''},
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
			 * UPDATE PROFILE
			 * ==========================================
			 *
			 * PUT /users/:clerkId/profile
			 */

			const updateProfileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);

			if (updateProfileMatch && request.method === 'PUT') {
				const clerkId = updateProfileMatch[1];

				const body = await request.json();

				const firstName = body?.first_name?.trim() || null;
				const lastName = body?.last_name?.trim() || null;
				const birthday = body?.birthday || null;
				const gender = body?.gender?.trim() || null;
				const country = body?.country?.trim() || null;
				const relationshipStatus = body?.relationship_status?.trim() || null;

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
