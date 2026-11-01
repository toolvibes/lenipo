import { z } from 'zod';
import { ProjectKey } from './tracking.js';

/** A time zone the runtime knows, e.g. "Europe/Berlin". */
const TimeZone = z
  .string()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone');

export const UpdateMeRequest = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    /** Language of the interface and of e-mails. */
    locale: z.enum(['de', 'en']),
    timeZone: TimeZone,
    /** Switches the single-key shortcuts of the web app on or off (TL-7). */
    keyboardShortcuts: z.boolean(),
  })
  .partial()
  .meta({ id: 'UpdateMeRequest' });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

export const OnboardingMethod = z.enum(['scrum', 'kanban', 'lore']);
export type OnboardingMethod = z.infer<typeof OnboardingMethod>;

/** Finishes the welcome steps (E-71); without `start` it only saves the profile (or skips). */
export const OnboardingRequest = z
  .object({
    profile: UpdateMeRequest.optional(),
    start: z
      .object({
        method: OnboardingMethod,
        name: z.string().trim().min(1).max(80),
        /** Key of the project, and of its wiki space. */
        key: ProjectKey,
      })
      .optional(),
  })
  .meta({ id: 'OnboardingRequest' });
export type OnboardingRequest = z.infer<typeof OnboardingRequest>;

/** Where to go next: the new board, the new space, or the overview. */
export const OnboardingResult = z
  .object({
    boardId: z.uuid().nullable(),
    spaceKey: z.string().nullable(),
  })
  .meta({ id: 'OnboardingResult' });
export type OnboardingResult = z.infer<typeof OnboardingResult>;
