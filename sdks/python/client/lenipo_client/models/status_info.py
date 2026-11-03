from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.status_category import StatusCategory
from uuid import UUID






T = TypeVar("T", bound="StatusInfo")



@_attrs_define
class StatusInfo:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            category (StatusCategory):
     """

    id: UUID
    key: str
    name: str
    category: StatusCategory





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        key = self.key

        name = self.name

        category = self.category.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "category": category,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        category = StatusCategory(d.pop("category"))




        status_info = cls(
            id=id,
            key=key,
            name=name,
            category=category,
        )

        return status_info

