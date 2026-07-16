import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().min(1).default('api'),
  DATABASE_URL: Joi.string().optional().allow(''),
  REDIS_HOST: Joi.string().trim().min(1).default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  QUEUE_NAME: Joi.string().trim().min(1).default('jobs'),
  MAX_JOB_ATTEMPTS: Joi.number().integer().min(1).default(3),
  JOB_BACKOFF_DELAY_MS: Joi.number().integer().min(0).default(1000),
  WORKER_CONCURRENCY: Joi.number().integer().min(1).default(1),
  WORKER_HEARTBEAT_INTERVAL_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5000),
  WORKER_HEARTBEAT_TTL_MS: Joi.number()
    .integer()
    .greater(Joi.ref('WORKER_HEARTBEAT_INTERVAL_MS'))
    .default(15000)
    .messages({
      'number.greater':
        'WORKER_HEARTBEAT_TTL_MS must be greater than WORKER_HEARTBEAT_INTERVAL_MS',
    }),
  JOB_PROCESSING_DELAY_MS: Joi.number().integer().min(0).default(1000),
}).unknown(true);
