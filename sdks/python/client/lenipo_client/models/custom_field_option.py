from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="CustomFieldOption")



@_attrs_define
class CustomFieldOption:
    """ 
        Attributes:
            id (UUID):
            value (str):
            archived (bool):
     """

    id: UUID
    value: str
    archived: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        value = self.value

        archived = self.archived


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "value": value,
            "archived": archived,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        value = d.pop("value")

        archived = d.pop("archived")

        custom_field_option = cls(
            id=id,
            value=value,
            archived=archived,
        )

        return custom_field_option

