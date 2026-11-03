from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="WorkingTimeInput")



@_attrs_define
class WorkingTimeInput:
    """ 
        Attributes:
            hours_per_day (float):
            days_per_week (int):
     """

    hours_per_day: float
    days_per_week: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        hours_per_day = self.hours_per_day

        days_per_week = self.days_per_week


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "hoursPerDay": hours_per_day,
            "daysPerWeek": days_per_week,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        hours_per_day = d.pop("hoursPerDay")

        days_per_week = d.pop("daysPerWeek")

        working_time_input = cls(
            hours_per_day=hours_per_day,
            days_per_week=days_per_week,
        )


        working_time_input.additional_properties = d
        return working_time_input

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
