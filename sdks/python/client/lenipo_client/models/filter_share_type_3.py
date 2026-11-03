from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="FilterShareType3")



@_attrs_define
class FilterShareType3:
    """ 
        Attributes:
            type_ (Literal['authenticated']):
     """

    type_: Literal['authenticated']





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['authenticated'] , d.pop("type"))
        if type_ != 'authenticated':
            raise ValueError(f"type must match const 'authenticated', got '{type_}'")

        filter_share_type_3 = cls(
            type_=type_,
        )

        return filter_share_type_3

