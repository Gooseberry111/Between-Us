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

/*
 * ==========================================
 * REACHABILITY
 * ==========================================
 *
 * Whether the phone can reach the API, learned from
 * the requests the app already makes rather than from
 * a native connectivity module -- so it travels in an
 * over-the-air update like everything else.
 */

let online = true;

const reachabilityListeners = new Set();

export function onReachabilityChange(listener) {
  reachabilityListeners.add(listener);

  listener(online);

  return () => reachabilityListeners.delete(listener);
}

function setOnline(value) {
  if (online === value) return;

  online = value;

  reachabilityListeners.forEach((listener) => listener(online));
}

export function setTokenProvider(fn) {
  getTokenFn = fn;
}

export { API_URL };

/*
 * The Authorization header on its own, for requests the
 * app does not make through fetch -- an Image reading a
 * photo back from the media store.
 */
export async function authHeaders() {
  try {
    const token = getTokenFn ? await getTokenFn() : null;

    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

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

  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });

    setOnline(true);

    return response;
  } catch (error) {
    /*
     * fetch only rejects when the request never got out:
     * no signal, aeroplane mode, DNS gone. Every screen
     * shows this message, so say something a person can
     * act on instead of "Network request failed".
     */
    console.log("REQUEST FAILED:", path, error?.message);

    setOnline(false);

    const offlineError = new Error(
      "You seem to be offline. Check your connection and try again.",
    );

    offlineError.offline = true;

    throw offlineError;
  }
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
