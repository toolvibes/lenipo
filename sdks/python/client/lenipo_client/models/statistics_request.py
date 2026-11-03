from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from ..types import UNSET, Unset






T = TypeVar("T", bound="StatisticsRequest")



@_attrs_define
class StatisticsRequest:
    """ 
        Attributes:
            query (str):
            x (StatisticField):
            y (StatisticField | Unset):
     """

    query: str
    x: StatisticField
    y: StatisticField | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        query = self.query

        x = self.x.value

        y: str | Unset = UNSET
        if not isinstance(self.y, Unset):
            y = self.y.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "query": query,
            "x": x,
        })
        if y is not UNSET:
            field_dict["y"] = y

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        query = d.pop("query")

        x = StatisticField(d.pop("x"))




        _y = d.pop("y", UNSET)
        y: StatisticField | Unset
        if isinstance(_y,  Unset):
            y = UNSET
        else:
            y = StatisticField(_y)




        statistics_request = cls(
            query=query,
            x=x,
            y=y,
        )


        statistics_request.additional_properties = d
        return statistics_request

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
