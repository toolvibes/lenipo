from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.burndown_estimation import BurndownEstimation
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.burndown_point import BurndownPoint
  from ..models.sprint import Sprint





T = TypeVar("T", bound="Burndown")



@_attrs_define
class Burndown:
    """ 
        Attributes:
            sprint (Sprint):
            estimation (BurndownEstimation):
            committed (float):
            planned_end (datetime.datetime | None):
            points (list[BurndownPoint]):
     """

    sprint: Sprint
    estimation: BurndownEstimation
    committed: float
    planned_end: datetime.datetime | None
    points: list[BurndownPoint]





    def to_dict(self) -> dict[str, Any]:
        from ..models.burndown_point import BurndownPoint # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        sprint = self.sprint.to_dict()

        estimation = self.estimation.value

        committed = self.committed

        planned_end: None | str
        if isinstance(self.planned_end, datetime.datetime):
            planned_end = self.planned_end.isoformat()
        else:
            planned_end = self.planned_end

        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprint": sprint,
            "estimation": estimation,
            "committed": committed,
            "plannedEnd": planned_end,
            "points": points,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.burndown_point import BurndownPoint # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        d = dict(src_dict)
        sprint = Sprint.from_dict(d.pop("sprint"))




        estimation = BurndownEstimation(d.pop("estimation"))




        committed = d.pop("committed")

        def _parse_planned_end(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                planned_end_type_0 = datetime.datetime.fromisoformat(data)



                return planned_end_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        planned_end = _parse_planned_end(d.pop("plannedEnd"))


        points = []
        _points = d.pop("points")
        for points_item_data in (_points):
            points_item = BurndownPoint.from_dict(points_item_data)



            points.append(points_item)


        burndown = cls(
            sprint=sprint,
            estimation=estimation,
            committed=committed,
            planned_end=planned_end,
            points=points,
        )

        return burndown

