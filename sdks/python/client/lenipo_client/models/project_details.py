from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_permission import ProjectPermission
from ..models.project_template import ProjectTemplate
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.issue_type_info import IssueTypeInfo
  from ..models.project_details_notification_scheme import ProjectDetailsNotificationScheme
  from ..models.project_details_permission_scheme import ProjectDetailsPermissionScheme
  from ..models.project_details_security_levels_item import ProjectDetailsSecurityLevelsItem
  from ..models.project_details_security_scheme_type_0 import ProjectDetailsSecuritySchemeType0
  from ..models.project_field_config import ProjectFieldConfig
  from ..models.status_info import StatusInfo
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ProjectDetails")



@_attrs_define
class ProjectDetails:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            description (str):
            template (ProjectTemplate):
            lead (None | UserRef):
            issue_count (int):
            created_at (datetime.datetime):
            favourite (bool):
            permission_scheme (ProjectDetailsPermissionScheme):
            notification_scheme (ProjectDetailsNotificationScheme):
            security_scheme (None | ProjectDetailsSecuritySchemeType0):
            security_levels (list[ProjectDetailsSecurityLevelsItem]):
            security_default_level_id (None | UUID):
            issue_types (list[IssueTypeInfo]):
            statuses (list[StatusInfo]):
            permissions (list[ProjectPermission]):
            custom_field_ids (list[UUID]):
            custom_field_settings (list[ProjectFieldConfig]):
     """

    id: UUID
    key: str
    name: str
    description: str
    template: ProjectTemplate
    lead: None | UserRef
    issue_count: int
    created_at: datetime.datetime
    favourite: bool
    permission_scheme: ProjectDetailsPermissionScheme
    notification_scheme: ProjectDetailsNotificationScheme
    security_scheme: None | ProjectDetailsSecuritySchemeType0
    security_levels: list[ProjectDetailsSecurityLevelsItem]
    security_default_level_id: None | UUID
    issue_types: list[IssueTypeInfo]
    statuses: list[StatusInfo]
    permissions: list[ProjectPermission]
    custom_field_ids: list[UUID]
    custom_field_settings: list[ProjectFieldConfig]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.project_details_notification_scheme import ProjectDetailsNotificationScheme # noqa: PLC0415
        from ..models.project_details_permission_scheme import ProjectDetailsPermissionScheme # noqa: PLC0415
        from ..models.project_details_security_levels_item import ProjectDetailsSecurityLevelsItem # noqa: PLC0415
        from ..models.project_details_security_scheme_type_0 import ProjectDetailsSecuritySchemeType0 # noqa: PLC0415
        from ..models.project_field_config import ProjectFieldConfig # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        key = self.key

        name = self.name

        description = self.description

        template = self.template.value

        lead: dict[str, Any] | None
        if isinstance(self.lead, UserRef):
            lead = self.lead.to_dict()
        else:
            lead = self.lead

        issue_count = self.issue_count

        created_at = self.created_at.isoformat()

        favourite = self.favourite

        permission_scheme = self.permission_scheme.to_dict()

        notification_scheme = self.notification_scheme.to_dict()

        security_scheme: dict[str, Any] | None
        if isinstance(self.security_scheme, ProjectDetailsSecuritySchemeType0):
            security_scheme = self.security_scheme.to_dict()
        else:
            security_scheme = self.security_scheme

        security_levels = []
        for security_levels_item_data in self.security_levels:
            security_levels_item = security_levels_item_data.to_dict()
            security_levels.append(security_levels_item)



        security_default_level_id: None | str
        if isinstance(self.security_default_level_id, UUID):
            security_default_level_id = str(self.security_default_level_id)
        else:
            security_default_level_id = self.security_default_level_id

        issue_types = []
        for issue_types_item_data in self.issue_types:
            issue_types_item = issue_types_item_data.to_dict()
            issue_types.append(issue_types_item)



        statuses = []
        for statuses_item_data in self.statuses:
            statuses_item = statuses_item_data.to_dict()
            statuses.append(statuses_item)



        permissions = []
        for permissions_item_data in self.permissions:
            permissions_item = permissions_item_data.value
            permissions.append(permissions_item)



        custom_field_ids = []
        for custom_field_ids_item_data in self.custom_field_ids:
            custom_field_ids_item = str(custom_field_ids_item_data)
            custom_field_ids.append(custom_field_ids_item)



        custom_field_settings = []
        for custom_field_settings_item_data in self.custom_field_settings:
            custom_field_settings_item = custom_field_settings_item_data.to_dict()
            custom_field_settings.append(custom_field_settings_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "description": description,
            "template": template,
            "lead": lead,
            "issueCount": issue_count,
            "createdAt": created_at,
            "favourite": favourite,
            "permissionScheme": permission_scheme,
            "notificationScheme": notification_scheme,
            "securityScheme": security_scheme,
            "securityLevels": security_levels,
            "securityDefaultLevelId": security_default_level_id,
            "issueTypes": issue_types,
            "statuses": statuses,
            "permissions": permissions,
            "customFieldIds": custom_field_ids,
            "customFieldSettings": custom_field_settings,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.project_details_notification_scheme import ProjectDetailsNotificationScheme # noqa: PLC0415
        from ..models.project_details_permission_scheme import ProjectDetailsPermissionScheme # noqa: PLC0415
        from ..models.project_details_security_levels_item import ProjectDetailsSecurityLevelsItem # noqa: PLC0415
        from ..models.project_details_security_scheme_type_0 import ProjectDetailsSecuritySchemeType0 # noqa: PLC0415
        from ..models.project_field_config import ProjectFieldConfig # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        description = d.pop("description")

        template = ProjectTemplate(d.pop("template"))




        def _parse_lead(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                lead_type_0 = UserRef.from_dict(data)



                return lead_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        lead = _parse_lead(d.pop("lead"))


        issue_count = d.pop("issueCount")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        favourite = d.pop("favourite")

        permission_scheme = ProjectDetailsPermissionScheme.from_dict(d.pop("permissionScheme"))




        notification_scheme = ProjectDetailsNotificationScheme.from_dict(d.pop("notificationScheme"))




        def _parse_security_scheme(data: object) -> None | ProjectDetailsSecuritySchemeType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                security_scheme_type_0 = ProjectDetailsSecuritySchemeType0.from_dict(data)



                return security_scheme_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProjectDetailsSecuritySchemeType0, data)

        security_scheme = _parse_security_scheme(d.pop("securityScheme"))


        security_levels = []
        _security_levels = d.pop("securityLevels")
        for security_levels_item_data in (_security_levels):
            security_levels_item = ProjectDetailsSecurityLevelsItem.from_dict(security_levels_item_data)



            security_levels.append(security_levels_item)


        def _parse_security_default_level_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                security_default_level_id_type_0 = UUID(data)



                return security_default_level_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        security_default_level_id = _parse_security_default_level_id(d.pop("securityDefaultLevelId"))


        issue_types = []
        _issue_types = d.pop("issueTypes")
        for issue_types_item_data in (_issue_types):
            issue_types_item = IssueTypeInfo.from_dict(issue_types_item_data)



            issue_types.append(issue_types_item)


        statuses = []
        _statuses = d.pop("statuses")
        for statuses_item_data in (_statuses):
            statuses_item = StatusInfo.from_dict(statuses_item_data)



            statuses.append(statuses_item)


        permissions = []
        _permissions = d.pop("permissions")
        for permissions_item_data in (_permissions):
            permissions_item = ProjectPermission(permissions_item_data)



            permissions.append(permissions_item)


        custom_field_ids = []
        _custom_field_ids = d.pop("customFieldIds")
        for custom_field_ids_item_data in (_custom_field_ids):
            custom_field_ids_item = UUID(custom_field_ids_item_data)



            custom_field_ids.append(custom_field_ids_item)


        custom_field_settings = []
        _custom_field_settings = d.pop("customFieldSettings")
        for custom_field_settings_item_data in (_custom_field_settings):
            custom_field_settings_item = ProjectFieldConfig.from_dict(custom_field_settings_item_data)



            custom_field_settings.append(custom_field_settings_item)


        project_details = cls(
            id=id,
            key=key,
            name=name,
            description=description,
            template=template,
            lead=lead,
            issue_count=issue_count,
            created_at=created_at,
            favourite=favourite,
            permission_scheme=permission_scheme,
            notification_scheme=notification_scheme,
            security_scheme=security_scheme,
            security_levels=security_levels,
            security_default_level_id=security_default_level_id,
            issue_types=issue_types,
            statuses=statuses,
            permissions=permissions,
            custom_field_ids=custom_field_ids,
            custom_field_settings=custom_field_settings,
        )

        return project_details

