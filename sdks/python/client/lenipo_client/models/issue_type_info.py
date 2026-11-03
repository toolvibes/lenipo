from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="IssueTypeInfo")



@_attrs_define
class IssueTypeInfo:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            icon (str):
            hierarchy_level (int):
     """

    id: UUID
    key: str
    name: str
    icon: str
    hierarchy_level: int





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        key = self.key

        name = self.name

        icon = self.icon

        hierarchy_level = self.hierarchy_level


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "icon": icon,
            "hierarchyLevel": hierarchy_level,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        icon = d.pop("icon")

        hierarchy_level = d.pop("hierarchyLevel")

        issue_type_info = cls(
            id=id,
            key=key,
            name=name,
            icon=icon,
            hierarchy_level=hierarchy_level,
        )

        return issue_type_info

