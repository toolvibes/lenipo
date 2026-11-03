from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="WorkingTime")



@_attrs_define
class WorkingTime:
    """ 
        Attributes:
            hours_per_day (float):
            days_per_week (int):
     """

    hours_per_day: float
    days_per_week: int





    def to_dict(self) -> dict[str, Any]:
        hours_per_day = self.hours_per_day

        days_per_week = self.days_per_week


        field_dict: dict[str, Any] = {}

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

        working_time = cls(
            hours_per_day=hours_per_day,
            days_per_week=days_per_week,
        )

        return working_time

