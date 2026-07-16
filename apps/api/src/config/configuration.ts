export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
}

export interface DatabaseConfig {
  url?: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface QueueConfig {
  name: string;
  maxAttempts: number;
  backoffDelayMs: number;
  workerConcurrency: number;
}

export interface WorkerConfig {
  heartbeatIntervalMs: number;
  heartbeatTtlMs: number;
  processingDelayMs: number;
}

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  queue: QueueConfig;
  worker: WorkerConfig;
}

export default (): AppConfiguration => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
  },
  database: {
    url: process.env.DATABASE_URL?.trim() || undefined,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
  },
  queue: {
    name: process.env.QUEUE_NAME ?? 'jobs',
    maxAttempts: Number(process.env.MAX_JOB_ATTEMPTS ?? 3),
    backoffDelayMs: Number(process.env.JOB_BACKOFF_DELAY_MS ?? 1000),
    workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
  },
  worker: {
    heartbeatIntervalMs: Number(
      process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 5000,
    ),
    heartbeatTtlMs: Number(process.env.WORKER_HEARTBEAT_TTL_MS ?? 15000),
    processingDelayMs: Number(process.env.JOB_PROCESSING_DELAY_MS ?? 1000),
  },
});
