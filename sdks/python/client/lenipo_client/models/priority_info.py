from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="PriorityInfo")



@_attrs_define
class PriorityInfo:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            icon (str):
            sequence (int):
     """

    id: UUID
    key: str
    name: str
    icon: str
    sequence: int





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        key = self.key

        name = self.name

        icon = self.icon

        sequence = self.sequence


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "icon": icon,
            "sequence": sequence,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        icon = d.pop("icon")

        sequence = d.pop("sequence")

        priority_info = cls(
            id=id,
            key=key,
            name=name,
            icon=icon,
            sequence=sequence,
        )

        return priority_info

