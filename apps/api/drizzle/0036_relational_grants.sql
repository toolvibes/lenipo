ALTER TYPE "public"."permission_grantee" ADD VALUE 'assignee';--> statement-breakpoint
ALTER TYPE "public"."permission_grantee" ADD VALUE 'reporter';--> statement-breakpoint
ALTER TABLE "permission_scheme_grants" DROP CONSTRAINT "permission_scheme_grants_one_grantee";--> statement-breakpoint
ALTER TABLE "permission_scheme_grants" ADD CONSTRAINT "permission_scheme_grants_one_grantee" CHECK ((grantee = 'role') = (role is not null)
        and (grantee = 'group') = (group_id is not null)
        and (grantee = 'user') = (user_id is not null));