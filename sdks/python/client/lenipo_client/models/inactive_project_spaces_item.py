from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InactiveProjectSpacesItem")



@_attrs_define
class InactiveProjectSpacesItem:
    """ 
        Attributes:
            key (str):
            name (str):
            inactive (bool):
     """

    key: str
    name: str
    inactive: bool





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name

        inactive = self.inactive


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "inactive": inactive,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        inactive = d.pop("inactive")

        inactive_project_spaces_item = cls(
            key=key,
            name=name,
            inactive=inactive,
        )

        return inactive_project_spaces_item

