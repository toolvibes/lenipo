from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RichTextInputType1")



@_attrs_define
class RichTextInputType1:
    """ 
        Attributes:
            markdown (str):
     """

    markdown: str





    def to_dict(self) -> dict[str, Any]:
        markdown = self.markdown


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "markdown": markdown,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        markdown = d.pop("markdown")

        rich_text_input_type_1 = cls(
            markdown=markdown,
        )

        return rich_text_input_type_1

