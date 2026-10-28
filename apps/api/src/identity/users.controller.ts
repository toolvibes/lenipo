import { Controller, Get, Inject } from '@nestjs/common';
import { UserLookup } from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import { UserService } from './user.service.js';

const SearchUsersQuery = z.object({
  query: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
type SearchUsersQuery = z.infer<typeof SearchUsersQuery>;

@Controller('users')
export class UsersController {
  constructor(@Inject(UserService) private readonly users: UserService) {}

  @Endpoint({
    tag: 'Users',
    summary: 'Find active users by name or email',
    description: 'Requires the global permission `browse-users`.',
    response: z.array(UserLookup),
  })
  @RequireGlobal('browse-users')
  @Get()
  search(@ValidQuery(SearchUsersQuery) query: SearchUsersQuery): Promise<UserLookup[]> {
    return this.users.search(query.query.trim(), query.limit);
  }
}
