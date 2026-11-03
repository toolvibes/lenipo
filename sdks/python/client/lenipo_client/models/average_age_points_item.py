from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="AverageAgePointsItem")



@_attrs_define
class AverageAgePointsItem:
    """ 
        Attributes:
            date (datetime.date):
            open_ (int):
            average_days (float):
     """

    date: datetime.date
    open_: int
    average_days: float





    def to_dict(self) -> dict[str, Any]:
        date = self.date.isoformat()

        open_ = self.open_

        average_days = self.average_days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "date": date,
            "open": open_,
            "averageDays": average_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        date = datetime.date.fromisoformat(d.pop("date"))




        open_ = d.pop("open")

        average_days = d.pop("averageDays")

        average_age_points_item = cls(
            date=date,
            open_=open_,
            average_days=average_days,
        )

        return average_age_points_item

