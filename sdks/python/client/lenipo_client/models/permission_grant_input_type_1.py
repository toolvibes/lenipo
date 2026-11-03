from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_permission import ProjectPermission
from uuid import UUID






T = TypeVar("T", bound="PermissionGrantInputType1")



@_attrs_define
class PermissionGrantInputType1:
    """ 
        Attributes:
            permission (ProjectPermission):
            group_id (UUID):
     """

    permission: ProjectPermission
    group_id: UUID





    def to_dict(self) -> dict[str, Any]:
        permission = self.permission.value

        group_id = str(self.group_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "permission": permission,
            "groupId": group_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        permission = ProjectPermission(d.pop("permission"))




        group_id = UUID(d.pop("groupId"))




        permission_grant_input_type_1 = cls(
            permission=permission,
            group_id=group_id,
        )

        return permission_grant_input_type_1

