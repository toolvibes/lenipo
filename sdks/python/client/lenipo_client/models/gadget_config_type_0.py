from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType0")



@_attrs_define
class GadgetConfigType0:
    """ 
        Attributes:
            type_ (Literal['filter-results']):
            query (str):
            limit (int):  Default: 10.
     """

    type_: Literal['filter-results']
    query: str
    limit: int = 10





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        limit = self.limit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "query": query,
            "limit": limit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['filter-results'] , d.pop("type"))
        if type_ != 'filter-results':
            raise ValueError(f"type must match const 'filter-results', got '{type_}'")

        query = d.pop("query")

        limit = d.pop("limit")

        gadget_config_type_0 = cls(
            type_=type_,
            query=query,
            limit=limit,
        )

        return gadget_config_type_0

