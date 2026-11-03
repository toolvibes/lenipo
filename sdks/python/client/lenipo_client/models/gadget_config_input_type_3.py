from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType3")



@_attrs_define
class GadgetConfigInputType3:
    """ 
        Attributes:
            type_ (Literal['pie']):
            query (str):
            field (StatisticField):
     """

    type_: Literal['pie']
    query: str
    field: StatisticField
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        field = self.field.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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




        gadget_config_input_type_3 = cls(
            type_=type_,
            query=query,
            field=field,
        )


        gadget_config_input_type_3.additional_properties = d
        return gadget_config_input_type_3

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
