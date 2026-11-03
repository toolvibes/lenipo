from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType3")



@_attrs_define
class GadgetConfigType3:
    """ 
        Attributes:
            type_ (Literal['pie']):
            query (str):
            field (StatisticField):
     """

    type_: Literal['pie']
    query: str
    field: StatisticField





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        field = self.field.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "query": query,
            "field": field,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['pie'] , d.pop("type"))
        if type_ != 'pie':
            raise ValueError(f"type must match const 'pie', got '{type_}'")

        query = d.pop("query")

        field = StatisticField(d.pop("field"))




        gadget_config_type_3 = cls(
            type_=type_,
            query=query,
            field=field,
        )

        return gadget_config_type_3

