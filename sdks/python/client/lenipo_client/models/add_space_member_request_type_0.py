from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.space_role import SpaceRole
from uuid import UUID






T = TypeVar("T", bound="AddSpaceMemberRequestType0")



@_attrs_define
class AddSpaceMemberRequestType0:
    """ 
        Attributes:
            role (SpaceRole):
            user_id (UUID):
     """

    role: SpaceRole
    user_id: UUID





    def to_dict(self) -> dict[str, Any]:
        role = self.role.value

        user_id = str(self.user_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "role": role,
            "userId": user_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = SpaceRole(d.pop("role"))




        user_id = UUID(d.pop("userId"))




        add_space_member_request_type_0 = cls(
            role=role,
            user_id=user_id,
        )

        return add_space_member_request_type_0

