import cors from 'cors';

function normalizeOrigin(value = '') {
  return value.trim().replace(/\/$/, '');
}

function parseAllowedOrigins() {
  const fromFrontendUrl = (process.env.FRONTEND_URL || '').split(',');
  const fromFrontendUrls = (process.env.FRONTEND_URLS || '').split(',');

  return [...fromFrontendUrl, ...fromFrontendUrls, 'http://localhost:5173']
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function createCorsMiddleware() {
  const allowedOrigins = parseAllowedOrigins();

  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
}
