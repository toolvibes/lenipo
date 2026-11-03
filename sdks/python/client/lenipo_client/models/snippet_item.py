from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SnippetItem")



@_attrs_define
class SnippetItem:
    """ 
        Attributes:
            text (str):
            hit (bool):
     """

    text: str
    hit: bool





    def to_dict(self) -> dict[str, Any]:
        text = self.text

        hit = self.hit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "text": text,
            "hit": hit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        text = d.pop("text")

        hit = d.pop("hit")

        snippet_item = cls(
            text=text,
            hit=hit,
        )

        return snippet_item

