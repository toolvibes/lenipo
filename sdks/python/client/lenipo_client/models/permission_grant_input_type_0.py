from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_permission import ProjectPermission
from ..models.project_role import ProjectRole






T = TypeVar("T", bound="PermissionGrantInputType0")



@_attrs_define
class PermissionGrantInputType0:
    """ 
        Attributes:
            permission (ProjectPermission):
            role (ProjectRole):
     """

    permission: ProjectPermission
    role: ProjectRole





    def to_dict(self) -> dict[str, Any]:
        permission = self.permission.value

        role = self.role.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "permission": permission,
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        permission = ProjectPermission(d.pop("permission"))




        role = ProjectRole(d.pop("role"))




        permission_grant_input_type_0 = cls(
            permission=permission,
            role=role,
        )

        return permission_grant_input_type_0

