from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigType4")



@_attrs_define
class GadgetConfigType4:
    """ 
        Attributes:
            type_ (Literal['two-dimensional']):
            query (str):
            x (StatisticField):
            y (StatisticField):
     """

    type_: Literal['two-dimensional']
    query: str
    x: StatisticField
    y: StatisticField





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        x = self.x.value

        y = self.y.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "query": query,
            "x": x,
            "y": y,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['two-dimensional'] , d.pop("type"))
        if type_ != 'two-dimensional':
            raise ValueError(f"type must match const 'two-dimensional', got '{type_}'")

        query = d.pop("query")

        x = StatisticField(d.pop("x"))




        y = StatisticField(d.pop("y"))




        gadget_config_type_4 = cls(
            type_=type_,
            query=query,
            x=x,
            y=y,
        )

        return gadget_config_type_4

