from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType5")



@_attrs_define
class GadgetConfigType5:
    """ 
        Attributes:
            type_ (Literal['created-vs-resolved']):
            query (str):
            days (int):  Default: 30.
     """

    type_: Literal['created-vs-resolved']
    query: str
    days: int = 30





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        days = self.days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "query": query,
            "days": days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['created-vs-resolved'] , d.pop("type"))
        if type_ != 'created-vs-resolved':
            raise ValueError(f"type must match const 'created-vs-resolved', got '{type_}'")

        query = d.pop("query")

        days = d.pop("days")

        gadget_config_type_5 = cls(
            type_=type_,
            query=query,
            days=days,
        )

        return gadget_config_type_5

