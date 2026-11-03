from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType4")



@_attrs_define
class GadgetConfigInputType4:
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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        x = self.x.value

        y = self.y.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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




        gadget_config_input_type_4 = cls(
            type_=type_,
            query=query,
            x=x,
            y=y,
        )


        gadget_config_input_type_4.additional_properties = d
        return gadget_config_input_type_4

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
