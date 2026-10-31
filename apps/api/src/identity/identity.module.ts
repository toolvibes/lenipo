import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessService } from '../access/access.service.js';
import { GlobalPermissionGuard } from '../access/require-global.js';
import { SystemController } from '../admin/system.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { InstanceController, OperationsController } from '../operations/operations.controller.js';
import { OperationsGuard } from '../operations/operations.guard.js';
import { OperationsService } from '../operations/operations.service.js';
import { AdminController } from './admin.controller.js';
import { AttemptLimiter } from './attempt-limiter.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { DirectoriesController } from './directories.controller.js';
import { DirectoryService } from './directory.service.js';
import { GroupService } from './group.service.js';
import { MeController } from './me.controller.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { OidcService } from './oidc.service.js';
import { PasswordService } from './password.service.js';
import { SamlController } from './saml.controller.js';
import { SamlService } from './saml.service.js';
import { SecuritySettingsService } from './security-settings.service.js';
import { SessionService } from './session.service.js';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';
import { TokenService } from './token.service.js';
import { TwoFactorService } from './two-factor.service.js';
import { UserService } from './user.service.js';
import { UserLifecycleService } from './user-lifecycle.service.js';
import { GroupsController, UsersController } from './users.controller.js';

@Module({
  controllers: [
    SetupController,
    InstanceController,
    OperationsController,
    AuthController,
    MeController,
    AdminController,
    SystemController,
    UsersController,
    GroupsController,
    OAuthController,
    DirectoriesController,
    SamlController,
  ],
  providers: [
    AccessService,
    SecuritySettingsService,
    TwoFactorService,
    AttemptLimiter,
    AuditService,
    AuthService,
    GroupService,
    OidcService,
    OAuthService,
    DirectoryService,
    SamlService,
    PasswordService,
    SessionService,
    SetupService,
    TokenService,
    UserService,
    UserLifecycleService,
    OperationsService,
    AuthGuard,
    OperationsGuard,
    GlobalPermissionGuard,
    // Order matters: authentication runs before the permission check.
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: OperationsGuard },
    { provide: APP_GUARD, useExisting: GlobalPermissionGuard },
  ],
  exports: [
    OperationsService,
    AccessService,
    AuditService,
    SessionService,
    SetupService,
    UserService,
    OAuthService,
    PasswordService,
    DirectoryService,
  ],
})
export class IdentityModule {}
