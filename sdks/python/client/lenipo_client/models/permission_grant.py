from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.permission_grantee import PermissionGrantee
from ..models.project_permission import ProjectPermission
from ..models.project_role import ProjectRole
from typing import cast

if TYPE_CHECKING:
  from ..models.permission_grant_group_type_0 import PermissionGrantGroupType0
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PermissionGrant")



@_attrs_define
class PermissionGrant:
    """ 
        Attributes:
            permission (ProjectPermission):
            grantee (PermissionGrantee):
            role (None | ProjectRole):
            group (None | PermissionGrantGroupType0):
            user (None | UserRef):
     """

    permission: ProjectPermission
    grantee: PermissionGrantee
    role: None | ProjectRole
    group: None | PermissionGrantGroupType0
    user: None | UserRef





    def to_dict(self) -> dict[str, Any]:
        from ..models.permission_grant_group_type_0 import PermissionGrantGroupType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        permission = self.permission.value

        grantee = self.grantee.value

        role: None | str
        if isinstance(self.role, ProjectRole):
            role = self.role.value
        else:
            role = self.role

        group: dict[str, Any] | None
        if isinstance(self.group, PermissionGrantGroupType0):
            group = self.group.to_dict()
        else:
            group = self.group

        user: dict[str, Any] | None
        if isinstance(self.user, UserRef):
            user = self.user.to_dict()
        else:
            user = self.user


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "permission": permission,
            "grantee": grantee,
            "role": role,
            "group": group,
            "user": user,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.permission_grant_group_type_0 import PermissionGrantGroupType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        permission = ProjectPermission(d.pop("permission"))




        grantee = PermissionGrantee(d.pop("grantee"))




        def _parse_role(data: object) -> None | ProjectRole:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                role_type_0 = ProjectRole(data)



                return role_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProjectRole, data)

        role = _parse_role(d.pop("role"))


        def _parse_group(data: object) -> None | PermissionGrantGroupType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                group_type_0 = PermissionGrantGroupType0.from_dict(data)



                return group_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PermissionGrantGroupType0, data)

        group = _parse_group(d.pop("group"))


        def _parse_user(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                user_type_0 = UserRef.from_dict(data)



                return user_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        user = _parse_user(d.pop("user"))


        permission_grant = cls(
            permission=permission,
            grantee=grantee,
            role=role,
            group=group,
            user=user,
        )

        return permission_grant

