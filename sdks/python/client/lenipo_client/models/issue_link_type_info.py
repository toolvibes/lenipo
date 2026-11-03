from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="IssueLinkTypeInfo")



@_attrs_define
class IssueLinkTypeInfo:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            outward (str):
            inward (str):
     """

    id: UUID
    key: str
    name: str
    outward: str
    inward: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        key = self.key

        name = self.name

        outward = self.outward

        inward = self.inward


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "outward": outward,
            "inward": inward,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        outward = d.pop("outward")

        inward = d.pop("inward")

        issue_link_type_info = cls(
            id=id,
            key=key,
            name=name,
            outward=outward,
            inward=inward,
        )

        return issue_link_type_info

