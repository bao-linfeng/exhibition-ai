import { randomUUID } from 'node:crypto';

export function percentile(
  samples: readonly number[],
  percentileValue: number,
): number {
  if (samples.length === 0)
    throw new Error('Cannot calculate percentile of no samples');
  const sorted = [...samples].sort((left, right) => left - right);
  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.ceil(sorted.length * percentileValue) - 1,
      )
    ] ?? 0
  );
}

export function testRunId(): string {
  return randomUUID();
}
