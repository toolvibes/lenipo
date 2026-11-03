from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.statistic_value import StatisticValue





T = TypeVar("T", bound="Statistics")



@_attrs_define
class Statistics:
    """ 
        Attributes:
            total (int):
            x (list[StatisticValue]):
            y (list[StatisticValue] | None):
            counts (list[list[int]]):
     """

    total: int
    x: list[StatisticValue]
    y: list[StatisticValue] | None
    counts: list[list[int]]





    def to_dict(self) -> dict[str, Any]:
        from ..models.statistic_value import StatisticValue # noqa: PLC0415
        total = self.total

        x = []
        for x_item_data in self.x:
            x_item = x_item_data.to_dict()
            x.append(x_item)



        y: list[dict[str, Any]] | None
        if isinstance(self.y, list):
            y = []
            for y_type_0_item_data in self.y:
                y_type_0_item = y_type_0_item_data.to_dict()
                y.append(y_type_0_item)


        else:
            y = self.y

        counts = []
        for counts_item_data in self.counts:
            counts_item = counts_item_data


            counts.append(counts_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "total": total,
            "x": x,
            "y": y,
            "counts": counts,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.statistic_value import StatisticValue # noqa: PLC0415
        d = dict(src_dict)
        total = d.pop("total")

        x = []
        _x = d.pop("x")
        for x_item_data in (_x):
            x_item = StatisticValue.from_dict(x_item_data)



            x.append(x_item)


        def _parse_y(data: object) -> list[StatisticValue] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                y_type_0 = []
                _y_type_0 = data
                for y_type_0_item_data in (_y_type_0):
                    y_type_0_item = StatisticValue.from_dict(y_type_0_item_data)



                    y_type_0.append(y_type_0_item)

                return y_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[StatisticValue] | None, data)

        y = _parse_y(d.pop("y"))


        counts = []
        _counts = d.pop("counts")
        for counts_item_data in (_counts):
            counts_item = cast(list[int], counts_item_data)

            counts.append(counts_item)


        statistics = cls(
            total=total,
            x=x,
            y=y,
            counts=counts,
        )

        return statistics

