import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessService } from '../access/access.service.js';
import { GlobalPermissionGuard } from '../access/require-global.js';
import { SystemController } from '../admin/system.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { AdminController } from './admin.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { GroupService } from './group.service.js';
import { MeController } from './me.controller.js';
import { OidcService } from './oidc.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';
import { TokenService } from './token.service.js';
import { UserService } from './user.service.js';

@Module({
  controllers: [SetupController, AuthController, MeController, AdminController, SystemController],
  providers: [
    AccessService,
    AuditService,
    AuthService,
    GroupService,
    OidcService,
    PasswordService,
    SessionService,
    SetupService,
    TokenService,
    UserService,
    AuthGuard,
    GlobalPermissionGuard,
    // Order matters: authentication runs before the permission check.
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: GlobalPermissionGuard },
  ],
  exports: [AccessService, AuditService, SessionService, SetupService, UserService],
})
export class IdentityModule {}
