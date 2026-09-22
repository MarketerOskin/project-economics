/**
 * Header carrying the session token as a bearer-style fallback for browsers that block the
 * session cookie outright inside the Bitrix24 iframe (ADR-024). Kept in its own file, free of
 * server-only imports (jose, node:crypto), so client code can import it without pulling
 * server crypto into the browser bundle.
 */
export const SESSION_HEADER = 'x-pe-session';
