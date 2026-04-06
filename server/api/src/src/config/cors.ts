import type { CorsOptions } from 'cors';
import { env } from './env';

const allowedOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : '*';

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
