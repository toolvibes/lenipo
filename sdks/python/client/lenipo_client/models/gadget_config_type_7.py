from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType7")



@_attrs_define
class GadgetConfigType7:
    """ 
        Attributes:
            type_ (Literal['calendar']):
            query (str):
     """

    type_: Literal['calendar']
    query: str





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "query": query,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['calendar'] , d.pop("type"))
        if type_ != 'calendar':
            raise ValueError(f"type must match const 'calendar', got '{type_}'")

        query = d.pop("query")

        gadget_config_type_7 = cls(
            type_=type_,
            query=query,
        )

        return gadget_config_type_7

