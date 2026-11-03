from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TextAnchor")



@_attrs_define
class TextAnchor:
    """ 
        Attributes:
            exact (str):
            prefix (str):
            suffix (str):
            block (int):
     """

    exact: str
    prefix: str
    suffix: str
    block: int





    def to_dict(self) -> dict[str, Any]:
        exact = self.exact

        prefix = self.prefix

        suffix = self.suffix

        block = self.block


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "exact": exact,
            "prefix": prefix,
            "suffix": suffix,
            "block": block,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        exact = d.pop("exact")

        prefix = d.pop("prefix")

        suffix = d.pop("suffix")

        block = d.pop("block")

        text_anchor = cls(
            exact=exact,
            prefix=prefix,
            suffix=suffix,
            block=block,
        )

        return text_anchor

