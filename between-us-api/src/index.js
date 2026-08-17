import { neon } from '@neondatabase/serverless';

export default {
	async fetch(request, env) {
		try {
			const sql = neon(env.DATABASE_URL);
			const url = new URL(request.url);

			// Health check
			if (url.pathname === '/health') {
				const result = await sql`SELECT NOW() AS time`;

				return Response.json({
					status: 'ok',
					database: true,
					time: result[0].time,
				});
			}

			// API home
			if (url.pathname === '/') {
				return Response.json({
					message: 'Between Us API is running',
				});
			}

			// Get all users
			if (url.pathname === '/users' && request.method === 'GET') {
				const users = await sql`
          SELECT id, clerk_id, email, created_at
          FROM users
          ORDER BY created_at DESC
        `;

				return Response.json(users);
			}

			// Create user
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
          INSERT INTO users (clerk_id, email)
          VALUES (${clerk_id}, ${email})
          RETURNING id, clerk_id, email, created_at
        `;

				return Response.json(
					{
						message: 'User created',
						user: result[0],
					},
					{ status: 201 },
				);
			}

			// Unknown route
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
