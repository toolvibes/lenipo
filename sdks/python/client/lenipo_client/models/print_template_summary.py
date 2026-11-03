from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="PrintTemplateSummary")



@_attrs_define
class PrintTemplateSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            is_default (bool):
     """

    id: UUID
    name: str
    is_default: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        is_default = self.is_default


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "isDefault": is_default,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        is_default = d.pop("isDefault")

        print_template_summary = cls(
            id=id,
            name=name,
            is_default=is_default,
        )

        return print_template_summary

