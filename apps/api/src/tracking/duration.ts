import { BadRequestException } from '@nestjs/common';
import type { WorkingTime } from '@toolvibes/shared';
import { parseDuration } from '@toolvibes/tql';

/** Parses a duration with the instance's working time or answers 400. */
export function durationSeconds(text: string, time: WorkingTime, field: string): number {
  const seconds = parseDuration(text, time);
  if (seconds === undefined) {
    throw new BadRequestException(`${field}: "${text}" is not a duration such as 2h, 1d 4h or 30m`);
  }
  return seconds;
}
