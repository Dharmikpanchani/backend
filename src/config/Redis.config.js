import Redis from 'ioredis';
import config from './Index.js';
import Logger from '../utils/Logger.js';

const logger = new Logger('src/config/Redis.config.js');

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    logger.warn(`Redis reconnecting due to error: ${err.message}`);
    return true;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error(`Redis connection error: ${err.message}`);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export default redis;
