export class AttemptConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttemptConsistencyError';
  }
}
