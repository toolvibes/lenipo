from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.created_resolved_points_item import CreatedResolvedPointsItem





T = TypeVar("T", bound="CreatedResolved")



@_attrs_define
class CreatedResolved:
    """ 
        Attributes:
            points (list[CreatedResolvedPointsItem]):
     """

    points: list[CreatedResolvedPointsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.created_resolved_points_item import CreatedResolvedPointsItem # noqa: PLC0415
        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "points": points,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.created_resolved_points_item import CreatedResolvedPointsItem # noqa: PLC0415
        d = dict(src_dict)
        points = []
        _points = d.pop("points")
        for points_item_data in (_points):
            points_item = CreatedResolvedPointsItem.from_dict(points_item_data)



            points.append(points_item)


        created_resolved = cls(
            points=points,
        )

        return created_resolved

