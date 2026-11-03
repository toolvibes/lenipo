from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.space_role import SpaceRole
from uuid import UUID






T = TypeVar("T", bound="AddSpaceMemberRequestType1")



@_attrs_define
class AddSpaceMemberRequestType1:
    """ 
        Attributes:
            role (SpaceRole):
            group_id (UUID):
     """

    role: SpaceRole
    group_id: UUID





    def to_dict(self) -> dict[str, Any]:
        role = self.role.value

        group_id = str(self.group_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "role": role,
            "groupId": group_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = SpaceRole(d.pop("role"))




        group_id = UUID(d.pop("groupId"))




        add_space_member_request_type_1 = cls(
            role=role,
            group_id=group_id,
        )

        return add_space_member_request_type_1

