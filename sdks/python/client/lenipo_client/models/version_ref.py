from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="VersionRef")



@_attrs_define
class VersionRef:
    """ 
        Attributes:
            id (UUID):
            name (str):
            released (bool):
     """

    id: UUID
    name: str
    released: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        released = self.released


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "released": released,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        released = d.pop("released")

        version_ref = cls(
            id=id,
            name=name,
            released=released,
        )

        return version_ref

