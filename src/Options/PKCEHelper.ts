/**
 * Helper for PKCE Request to OAuth2 APIs.
 * @source https://developer.okta.com/blog/2019/05/01/is-the-oauth-implicit-flow-dead
 */

// Generate a secure random string using the browser crypto functions
export function generateRandomString() {
	var array = new Uint32Array(28);
	window.crypto.getRandomValues(array);
	return Array.from(array, (dec) => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Calculate the SHA256 hash of the input text.
// Returns a promise that resolves to an ArrayBuffer
export function sha256(plain: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return window.crypto.subtle.digest('SHA-256', data);
}

// Base64-urlencodes the input string
export function base64urlencode(str: ArrayBuffer) {
	// Convert the ArrayBuffer to string using Uint8 array to convert to what btoa accepts.
	// btoa accepts chars only within ascii 0-255 and base64 encodes them.
	// Then convert the base64 encoded to base64url encoded
	//   (replace + with -, replace / with _, trim trailing =)
	return btoa(String.fromCharCode.apply(null, (<unknown>new Uint8Array(str)) as number[]))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

// Return the base64-urlencoded sha256 hash for the PKCE challenge
export async function pkceChallengeFromVerifier(v: string) {
	const hashed = await sha256(v);
	return base64urlencode(hashed);
}
