/*
 * ==========================================
 * API CLIENT
 * ==========================================
 *
 * Every call carries the signed Clerk session
 * token. The API refuses anything without one,
 * and checks the token's own user id against the
 * id in the path -- so a request can only ever
 * touch the account it belongs to.
 *
 * The token getter is registered once at startup
 * rather than threaded through every screen,
 * because Clerk only exposes it through a hook.
 */

const API_URL = "https://between-us-api.between-us.workers.dev";

let getTokenFn = null;

export function setTokenProvider(fn) {
  getTokenFn = fn;
}

export { API_URL };

export async function apiFetch(path, options = {}) {
  let token = null;

  /*
   * Right after signing in, Clerk can briefly hand back no
   * token while the session activates. Sending the request
   * anyway gets it rejected, so wait a moment and ask again.
   */
  if (getTokenFn) {
    for (let attempt = 0; attempt < 4 && !token; attempt++) {
      try {
        token = await getTokenFn();
      } catch (error) {
        console.log("TOKEN FETCH ERROR:", error);
      }

      if (!token && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
      }
    }
  }

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

/*
 * Same thing, but parses the body and throws on a
 * non-2xx so callers can use try/catch.
 */
export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}
