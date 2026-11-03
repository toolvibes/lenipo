from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="FilterShareType2Project")



@_attrs_define
class FilterShareType2Project:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
     """

    id: UUID
    key: str
    name: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        key = self.key

        name = self.name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        filter_share_type_2_project = cls(
            id=id,
            key=key,
            name=name,
        )

        return filter_share_type_2_project

