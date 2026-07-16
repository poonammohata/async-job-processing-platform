export class InvalidJobScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobScheduleError';
  }
}
