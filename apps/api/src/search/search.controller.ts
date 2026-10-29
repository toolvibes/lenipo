import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateFilterRequest,
  FilterListQuery,
  SavedFilter,
  SearchRequest,
  SearchResult,
  UpdateFilterRequest,
  ValueSuggestion,
  ValueSuggestionQuery,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { FilterService } from './filter.service.js';
import { SearchService } from './search.service.js';

/** Unknown and malformed filter ids are both "not found". */
const FilterId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller()
export class SearchController {
  constructor(
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(FilterService) private readonly filters: FilterService,
  ) {}

  @Endpoint({
    tag: 'Search',
    summary: 'Search issues with TQL',
    description:
      'Runs a TQL query over the projects the caller can browse. An invalid query answers 400 with `queryErrors` (code, message and position of each error).',
    response: SearchResult,
  })
  @Post('search')
  @HttpCode(200)
  run(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(SearchRequest) body: SearchRequest,
  ): Promise<SearchResult> {
    return this.search.search(principal, body);
  }

  @Endpoint({
    tag: 'Search',
    summary: 'Suggest stored values for a TQL field',
    description: 'For autocompletion: `value` is the canonical text to put into the query.',
    response: z.array(ValueSuggestion),
  })
  @Get('search/suggestions')
  suggestions(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(ValueSuggestionQuery) query: ValueSuggestionQuery,
  ): Promise<ValueSuggestion[]> {
    return this.search.suggestions(principal, query);
  }

  @Endpoint({
    tag: 'Filters',
    summary: 'List saved filters the caller can see',
    response: z.array(SavedFilter),
  })
  @Get('filters')
  list(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(FilterListQuery) query: FilterListQuery,
  ): Promise<SavedFilter[]> {
    return this.filters.list(principal, query.scope);
  }

  @Endpoint({
    tag: 'Filters',
    summary: 'Save a TQL query as a filter',
    description: 'Sharing requires the global permission `share-filters`.',
    response: SavedFilter,
  })
  @Post('filters')
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateFilterRequest) body: CreateFilterRequest,
  ): Promise<SavedFilter> {
    return this.filters.create(principal, body);
  }

  @Endpoint({ tag: 'Filters', summary: 'Get a saved filter', response: SavedFilter })
  @Get('filters/:id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', FilterId) id: string,
  ): Promise<SavedFilter> {
    return this.filters.get(principal, id);
  }

  @Endpoint({
    tag: 'Filters',
    summary: 'Change a saved filter (owner only)',
    response: SavedFilter,
  })
  @Patch('filters/:id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', FilterId) id: string,
    @ValidBody(UpdateFilterRequest) body: UpdateFilterRequest,
  ): Promise<SavedFilter> {
    return this.filters.update(principal, id, body);
  }

  @Endpoint({ tag: 'Filters', summary: 'Delete a saved filter (owner or administrator)' })
  @Delete('filters/:id')
  @HttpCode(204)
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', FilterId) id: string,
  ): Promise<void> {
    return this.filters.delete(principal, id);
  }

  @Endpoint({ tag: 'Filters', summary: 'Mark a filter as favourite' })
  @Put('filters/:id/favourite')
  @HttpCode(204)
  favourite(
    @CurrentPrincipal() principal: Principal,
    @Param('id', FilterId) id: string,
  ): Promise<void> {
    return this.filters.setFavourite(principal, id, true);
  }

  @Endpoint({ tag: 'Filters', summary: 'Remove a filter from the favourites' })
  @Delete('filters/:id/favourite')
  @HttpCode(204)
  unfavourite(
    @CurrentPrincipal() principal: Principal,
    @Param('id', FilterId) id: string,
  ): Promise<void> {
    return this.filters.setFavourite(principal, id, false);
  }
}
