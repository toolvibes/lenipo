import { z } from 'zod';
import { ReportConfig, StatisticField } from './reports.js';
import { FilterShare, FilterShareInput, TqlText } from './search.js';

const Id = z.uuid();

/**
 * Column layouts of a dashboard (TL-20, E-101): one column, two equal, two with a wide left
 * column, three equal.
 */
export const DASHBOARD_LAYOUTS = ['one', 'two', 'wide-left', 'three'] as const;
export const DashboardLayout = z.enum(DASHBOARD_LAYOUTS).meta({ id: 'DashboardLayout' });
export type DashboardLayout = z.infer<typeof DashboardLayout>;

export function columnCount(layout: DashboardLayout): number {
  return layout === 'one' ? 1 : layout === 'three' ? 3 : 2;
}

const Limit = z.number().int().min(1).max(50);

/** What a gadget shows; every query runs with the viewer's permissions (E-101). */
export const GadgetConfig = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('filter-results'), query: TqlText, limit: Limit.default(10) }),
    z.object({ type: z.literal('assigned-to-me'), limit: Limit.default(10) }),
    z.object({
      type: z.literal('activity'),
      projectKey: z.string().max(20).nullable().default(null),
      limit: Limit.default(10),
    }),
    z.object({ type: z.literal('pie'), query: TqlText, field: StatisticField }),
    z.object({
      type: z.literal('two-dimensional'),
      query: TqlText,
      x: StatisticField,
      y: StatisticField,
    }),
    z.object({
      type: z.literal('created-vs-resolved'),
      query: TqlText,
      days: z.number().int().min(7).max(365).default(30),
    }),
    z.object({ type: z.literal('sprint-burndown'), boardId: Id }),
    z.object({ type: z.literal('calendar'), query: TqlText }),
    z.object({ type: z.literal('wiki-page'), pageId: Id }),
    z.object({ type: z.literal('text'), markdown: z.string().max(20_000) }),
    /** Any report of the reports page (TL-21, E-102). */
    z.object({ type: z.literal('report'), report: ReportConfig }),
  ])
  .meta({ id: 'GadgetConfig' });
export type GadgetConfig = z.infer<typeof GadgetConfig>;
export type GadgetType = GadgetConfig['type'];
export const GADGET_TYPES = [
  'filter-results',
  'assigned-to-me',
  'activity',
  'pie',
  'two-dimensional',
  'created-vs-resolved',
  'sprint-burndown',
  'calendar',
  'wiki-page',
  'text',
  'report',
] as const satisfies readonly GadgetType[];

export const Gadget = z
  .object({ id: Id, title: z.string(), config: GadgetConfig })
  .meta({ id: 'Gadget' });
export type Gadget = z.infer<typeof Gadget>;

const DashboardName = z.string().trim().min(1).max(100);

export const DashboardSummary = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    layout: DashboardLayout,
    owner: z.object({ id: Id, displayName: z.string() }),
    shares: z.array(FilterShare),
    favourite: z.boolean(),
    /** The person's start page instead of the usual home. */
    home: z.boolean(),
    /** True for the owner and administrators. */
    editable: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'DashboardSummary' });
export type DashboardSummary = z.infer<typeof DashboardSummary>;

export const Dashboard = DashboardSummary.extend({
  /** Gadgets per column, top to bottom. */
  columns: z.array(z.array(Gadget)),
}).meta({ id: 'Dashboard' });
export type Dashboard = z.infer<typeof Dashboard>;

/** `home` lists the person's start dashboard, if any. */
export const DashboardScope = z.enum(['visible', 'mine', 'shared', 'favourites', 'home']);
export type DashboardScope = z.infer<typeof DashboardScope>;
export const DashboardListQuery = z.object({ scope: DashboardScope.default('visible') });
export type DashboardListQuery = z.infer<typeof DashboardListQuery>;

export const CreateDashboardRequest = z
  .object({
    name: DashboardName,
    description: z.string().max(1_000).default(''),
    layout: DashboardLayout.default('two'),
    shares: z.array(FilterShareInput).max(50).default([]),
  })
  .meta({ id: 'CreateDashboardRequest' });
export type CreateDashboardRequest = z.infer<typeof CreateDashboardRequest>;

export const UpdateDashboardRequest = z
  .object({
    name: DashboardName,
    description: z.string().max(1_000),
    layout: DashboardLayout,
    shares: z.array(FilterShareInput).max(50),
  })
  .partial()
  .meta({ id: 'UpdateDashboardRequest' });
export type UpdateDashboardRequest = z.infer<typeof UpdateDashboardRequest>;

export const CopyDashboardRequest = z
  .object({ name: DashboardName })
  .meta({ id: 'CopyDashboardRequest' });
export type CopyDashboardRequest = z.infer<typeof CopyDashboardRequest>;

export const AddGadgetRequest = z
  .object({
    column: z.number().int().min(0).max(2).default(0),
    title: z.string().trim().max(100).default(''),
    config: GadgetConfig,
  })
  .meta({ id: 'AddGadgetRequest' });
export type AddGadgetRequest = z.infer<typeof AddGadgetRequest>;

export const UpdateGadgetRequest = z
  .object({ title: z.string().trim().max(100), config: GadgetConfig })
  .partial()
  .meta({ id: 'UpdateGadgetRequest' });
export type UpdateGadgetRequest = z.infer<typeof UpdateGadgetRequest>;

/** The new order: gadget ids per column; every gadget exactly once. */
export const ArrangeGadgetsRequest = z
  .object({ columns: z.array(z.array(Id).max(50)).min(1).max(3) })
  .meta({ id: 'ArrangeGadgetsRequest' });
export type ArrangeGadgetsRequest = z.infer<typeof ArrangeGadgetsRequest>;
