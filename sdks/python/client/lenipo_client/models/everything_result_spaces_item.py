from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EverythingResultSpacesItem")



@_attrs_define
class EverythingResultSpacesItem:
    """ 
        Attributes:
            key (str):
            name (str):
            description (str):
     """

    key: str
    name: str
    description: str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        description = d.pop("description")

        everything_result_spaces_item = cls(
            key=key,
            name=name,
            description=description,
        )

        return everything_result_spaces_item

