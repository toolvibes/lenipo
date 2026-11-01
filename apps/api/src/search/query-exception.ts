import { BadRequestException } from '@nestjs/common';
import type { TqlError } from '@toolvibes/tql';

/** A TQL query that cannot run; rendered as problem details with the errors and their positions. */
export class QueryException extends BadRequestException {
  constructor(readonly queryErrors: TqlError[]) {
    super({
      type: 'urn:lenipo:problem:query',
      message: queryErrors[0]?.message ?? 'The query is invalid',
      queryErrors,
    });
  }
}
