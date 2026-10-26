const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "rfh_token";

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Calls the backend. Adds the login token, and returns the JSON.
// On failure it throws an Error with .status and .code (see the API specification).
export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    // An expired or invalid token: back to the login page (but not when the login itself fails)
    if (res.status === 401 && token && !path.startsWith("/auth/staff/login")) {
      clearToken();
      // A full page load is intended here: it also resets all page state
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/staff/login";
    }
    const err = new Error(data?.error || "Something went wrong");
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}
