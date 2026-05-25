const _rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3030";
export const BACKEND_URL = _rawBackendUrl.replace(/\/+$/, ""); // strip any trailing slash(es)

export const GOOGLE_CLIENT_ID =
	import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
