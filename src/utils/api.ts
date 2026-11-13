const configuredBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
const API_BASE = (configuredBase || '').trim().replace(/\/+$/, '');

/** Build an API URL for the separately hosted Express backend. */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
}
