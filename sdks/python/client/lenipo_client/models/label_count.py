from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="LabelCount")



@_attrs_define
class LabelCount:
    """ 
        Attributes:
            label (str):
            pages (int):
     """

    label: str
    pages: int





    def to_dict(self) -> dict[str, Any]:
        label = self.label

        pages = self.pages


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "label": label,
            "pages": pages,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        label = d.pop("label")

        pages = d.pop("pages")

        label_count = cls(
            label=label,
            pages=pages,
        )

        return label_count

