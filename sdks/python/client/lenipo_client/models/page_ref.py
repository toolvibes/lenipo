from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="PageRef")



@_attrs_define
class PageRef:
    """ 
        Attributes:
            id (UUID):
            title (str):
     """

    id: UUID
    title: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        title = self.title


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        page_ref = cls(
            id=id,
            title=title,
        )

        return page_ref

