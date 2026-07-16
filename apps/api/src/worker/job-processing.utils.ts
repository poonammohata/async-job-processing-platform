const MAX_ERROR_MESSAGE_LENGTH = 500;

export function getPayloadKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload as Record<string, unknown>).sort();
}

export function sanitizeProcessingError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');

  return message.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function evaluateSimulationFailure(
  payload: unknown,
  attemptNumber: number,
): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return;
  }

  const simulationPayload = payload as Record<string, unknown>;

  if (simulationPayload.shouldFail === true) {
    throw new Error('Simulated permanent processing failure');
  }

  const failUntilAttempt = simulationPayload.failUntilAttempt;

  if (
    typeof failUntilAttempt === 'number' &&
    Number.isInteger(failUntilAttempt) &&
    attemptNumber <= failUntilAttempt
  ) {
    throw new Error(`Simulated failure on attempt ${attemptNumber}`);
  }
}
