const PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="12" fill="#1f2937" />
  <path
    d="M32 12c7.732 0 14 6.268 14 14 0 10.5-14 26-14 26S18 36.5 18 26c0-7.732 6.268-14 14-14z"
    fill="#4b5563"
  />
  <circle cx="32" cy="26" r="6" fill="#9ca3af" />
</svg>
`;

export const DEFAULT_GYM_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  PLACEHOLDER_SVG
)}`;

export const resolveGymImage = (url?: string | null): string => {
  if (url && url.trim().length > 0) {
    return url;
  }

  return DEFAULT_GYM_IMAGE;
};
