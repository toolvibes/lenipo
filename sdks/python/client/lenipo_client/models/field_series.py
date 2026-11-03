from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.statistic_value import StatisticValue





T = TypeVar("T", bound="FieldSeries")



@_attrs_define
class FieldSeries:
    """ 
        Attributes:
            dates (list[datetime.date]):
            values (list[StatisticValue]):
            counts (list[list[int]]):
            truncated (bool):
     """

    dates: list[datetime.date]
    values: list[StatisticValue]
    counts: list[list[int]]
    truncated: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.statistic_value import StatisticValue # noqa: PLC0415
        dates = []
        for dates_item_data in self.dates:
            dates_item = dates_item_data.isoformat()
            dates.append(dates_item)



        values = []
        for values_item_data in self.values:
            values_item = values_item_data.to_dict()
            values.append(values_item)



        counts = []
        for counts_item_data in self.counts:
            counts_item = counts_item_data


            counts.append(counts_item)



        truncated = self.truncated


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "dates": dates,
            "values": values,
            "counts": counts,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.statistic_value import StatisticValue # noqa: PLC0415
        d = dict(src_dict)
        dates = []
        _dates = d.pop("dates")
        for dates_item_data in (_dates):
            dates_item = datetime.date.fromisoformat(dates_item_data)



            dates.append(dates_item)


        values = []
        _values = d.pop("values")
        for values_item_data in (_values):
            values_item = StatisticValue.from_dict(values_item_data)



            values.append(values_item)


        counts = []
        _counts = d.pop("counts")
        for counts_item_data in (_counts):
            counts_item = cast(list[int], counts_item_data)

            counts.append(counts_item)


        truncated = d.pop("truncated")

        field_series = cls(
            dates=dates,
            values=values,
            counts=counts,
            truncated=truncated,
        )

        return field_series

