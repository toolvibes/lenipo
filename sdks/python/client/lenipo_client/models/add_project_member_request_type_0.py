from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole
from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="AddProjectMemberRequestType0")



@_attrs_define
class AddProjectMemberRequestType0:
    """ 
        Attributes:
            role (ProjectRole):
            user_id (UUID):
            share_space (bool | Unset):
     """

    role: ProjectRole
    user_id: UUID
    share_space: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        role = self.role.value

        user_id = str(self.user_id)

        share_space = self.share_space


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "role": role,
            "userId": user_id,
        })
        if share_space is not UNSET:
            field_dict["shareSpace"] = share_space

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = ProjectRole(d.pop("role"))




        user_id = UUID(d.pop("userId"))




        share_space = d.pop("shareSpace", UNSET)

        add_project_member_request_type_0 = cls(
            role=role,
            user_id=user_id,
            share_space=share_space,
        )

        return add_project_member_request_type_0

