import { JobPriority } from '@prisma/client';
import { mapJobPriorityToBullMq } from '../queue.types';

describe('mapJobPriorityToBullMq', () => {
  it('maps HIGH to 1', () => {
    expect(mapJobPriorityToBullMq(JobPriority.HIGH)).toBe(1);
  });

  it('maps NORMAL to 5', () => {
    expect(mapJobPriorityToBullMq(JobPriority.NORMAL)).toBe(5);
  });

  it('maps LOW to 10', () => {
    expect(mapJobPriorityToBullMq(JobPriority.LOW)).toBe(10);
  });
});
