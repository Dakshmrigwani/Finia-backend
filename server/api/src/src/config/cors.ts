import type { CorsOptions } from 'cors';
import { env } from './env';

const allowedOrigins =  process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : '*';

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200,
};
