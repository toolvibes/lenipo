from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.global_permission import GlobalPermission
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="GroupSummary")



@_attrs_define
class GroupSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            member_count (int):
            global_permissions (list[GlobalPermission]):
     """

    id: UUID
    name: str
    description: str
    member_count: int
    global_permissions: list[GlobalPermission]





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        description = self.description

        member_count = self.member_count

        global_permissions = []
        for global_permissions_item_data in self.global_permissions:
            global_permissions_item = global_permissions_item_data.value
            global_permissions.append(global_permissions_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "memberCount": member_count,
            "globalPermissions": global_permissions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        member_count = d.pop("memberCount")

        global_permissions = []
        _global_permissions = d.pop("globalPermissions")
        for global_permissions_item_data in (_global_permissions):
            global_permissions_item = GlobalPermission(global_permissions_item_data)



            global_permissions.append(global_permissions_item)


        group_summary = cls(
            id=id,
            name=name,
            description=description,
            member_count=member_count,
            global_permissions=global_permissions,
        )

        return group_summary

