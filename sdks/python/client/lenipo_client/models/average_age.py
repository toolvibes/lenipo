from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.average_age_points_item import AverageAgePointsItem





T = TypeVar("T", bound="AverageAge")



@_attrs_define
class AverageAge:
    """ 
        Attributes:
            points (list[AverageAgePointsItem]):
            truncated (bool):
     """

    points: list[AverageAgePointsItem]
    truncated: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.average_age_points_item import AverageAgePointsItem # noqa: PLC0415
        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)



        truncated = self.truncated


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "points": points,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.average_age_points_item import AverageAgePointsItem # noqa: PLC0415
        d = dict(src_dict)
        points = []
        _points = d.pop("points")
        for points_item_data in (_points):
            points_item = AverageAgePointsItem.from_dict(points_item_data)



            points.append(points_item)


        truncated = d.pop("truncated")

        average_age = cls(
            points=points,
            truncated=truncated,
        )

        return average_age

