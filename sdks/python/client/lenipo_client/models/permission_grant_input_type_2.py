from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_permission import ProjectPermission
from uuid import UUID






T = TypeVar("T", bound="PermissionGrantInputType2")



@_attrs_define
class PermissionGrantInputType2:
    """ 
        Attributes:
            permission (ProjectPermission):
            user_id (UUID):
     """

    permission: ProjectPermission
    user_id: UUID





    def to_dict(self) -> dict[str, Any]:
        permission = self.permission.value

        user_id = str(self.user_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "permission": permission,
            "userId": user_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        permission = ProjectPermission(d.pop("permission"))




        user_id = UUID(d.pop("userId"))




        permission_grant_input_type_2 = cls(
            permission=permission,
            user_id=user_id,
        )

        return permission_grant_input_type_2

