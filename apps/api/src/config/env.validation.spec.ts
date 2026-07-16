import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  it('accepts valid defaults', () => {
    const { error, value } = envValidationSchema.validate({});

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api');
    expect(value.MAX_JOB_ATTEMPTS).toBe(3);
    expect(value.WORKER_HEARTBEAT_INTERVAL_MS).toBe(5000);
    expect(value.WORKER_HEARTBEAT_TTL_MS).toBe(15000);
  });

  it('rejects invalid MAX_JOB_ATTEMPTS', () => {
    const { error } = envValidationSchema.validate({
      MAX_JOB_ATTEMPTS: 0,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('MAX_JOB_ATTEMPTS');
  });

  it('rejects heartbeat TTL less than or equal to heartbeat interval', () => {
    const { error } = envValidationSchema.validate({
      WORKER_HEARTBEAT_INTERVAL_MS: 5000,
      WORKER_HEARTBEAT_TTL_MS: 5000,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain(
      'WORKER_HEARTBEAT_TTL_MS must be greater than WORKER_HEARTBEAT_INTERVAL_MS',
    );
  });
});
