import { sanitizeProcessingError, evaluateSimulationFailure, getPayloadKeys } from '../job-processing.utils';

describe('job-processing.utils', () => {
  describe('getPayloadKeys', () => {
    it('returns sorted payload keys', () => {
      expect(getPayloadKeys({ b: 1, a: 2 })).toEqual(['a', 'b']);
    });
  });

  describe('sanitizeProcessingError', () => {
    it('returns the error message without stack trace', () => {
      const error = new Error('Simulated failure');
      error.stack = 'Error: Simulated failure\n    at Object.<anonymous>';

      expect(sanitizeProcessingError(error)).toBe('Simulated failure');
    });

    it('truncates long messages', () => {
      const longMessage = 'x'.repeat(600);

      expect(sanitizeProcessingError(new Error(longMessage))).toHaveLength(500);
    });
  });

  describe('evaluateSimulationFailure', () => {
    it('throws for shouldFail=true', () => {
      expect(() =>
        evaluateSimulationFailure({ shouldFail: true }, 1),
      ).toThrow('Simulated permanent processing failure');
    });

    it('throws when attemptNumber is less than or equal to failUntilAttempt', () => {
      expect(() =>
        evaluateSimulationFailure({ failUntilAttempt: 2 }, 1),
      ).toThrow('Simulated failure on attempt 1');

      expect(() =>
        evaluateSimulationFailure({ failUntilAttempt: 2 }, 2),
      ).toThrow('Simulated failure on attempt 2');
    });

    it('succeeds when attemptNumber exceeds failUntilAttempt', () => {
      expect(() =>
        evaluateSimulationFailure({ failUntilAttempt: 2 }, 3),
      ).not.toThrow();
    });
  });
});
