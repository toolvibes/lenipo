from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType9")



@_attrs_define
class GadgetConfigType9:
    """ 
        Attributes:
            type_ (Literal['text']):
            markdown (str):
     """

    type_: Literal['text']
    markdown: str





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        markdown = self.markdown


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "markdown": markdown,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['text'] , d.pop("type"))
        if type_ != 'text':
            raise ValueError(f"type must match const 'text', got '{type_}'")

        markdown = d.pop("markdown")

        gadget_config_type_9 = cls(
            type_=type_,
            markdown=markdown,
        )

        return gadget_config_type_9

