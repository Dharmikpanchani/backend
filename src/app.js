import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import router from './routes/IndexRoutes.js';
import Logger from './utils/Logger.js';
import { apiLimiter } from './middleware/RateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const logger = new Logger('app.js');

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' })); // For images

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  // Add other origins as needed
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const isAllowedSubdomain =
        /^http:\/\/[a-zA-Z0-9-]+\.(lvh\.me|localhost):5173$/.test(origin);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        isAllowedSubdomain ||
        process.env.NODE_ENV === 'development'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // required to send/receive cookies
  })
);

app.disable('x-powered-by');

// Webhook raw body middleware MUST be before body parsers for this route
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieParser(process.env.COOKIE_SECRET || 'cookie_secret_school_saas_prod')
);
app.use(compression());

// Apply rate limiter to all api routes
app.use('/api', apiLimiter);

app.use(express.static(path.join(__dirname, '../public')));
app.use(
  '/api/images',
  express.static(path.join(__dirname, '../public/uploads'))
);

// Removed manual CORS headers as they conflict with the 'cors' middleware configuration
// and specifically break with 'credentials: true' which forbids '*' origin.

// Logger for route calls
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationMs = duration[0] * 1000 + duration[1] / 1e6;
    const logMessage = `Route called: ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${durationMs.toFixed(2)} ms`;
    logger.info(logMessage);
  });
  next();
});

app.use('/api', router);
app.set('views', path.join(__dirname, 'views'));

export default app;
