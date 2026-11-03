from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sprint_report_estimation import SprintReportEstimation
from typing import cast

if TYPE_CHECKING:
  from ..models.sprint import Sprint
  from ..models.sprint_report_entry import SprintReportEntry





T = TypeVar("T", bound="SprintReport")



@_attrs_define
class SprintReport:
    """ 
        Attributes:
            sprint (Sprint):
            estimation (SprintReportEstimation):
            completed (list[SprintReportEntry]):
            not_completed (list[SprintReportEntry]):
            removed (list[SprintReportEntry]):
     """

    sprint: Sprint
    estimation: SprintReportEstimation
    completed: list[SprintReportEntry]
    not_completed: list[SprintReportEntry]
    removed: list[SprintReportEntry]





    def to_dict(self) -> dict[str, Any]:
        from ..models.sprint import Sprint # noqa: PLC0415
        from ..models.sprint_report_entry import SprintReportEntry # noqa: PLC0415
        sprint = self.sprint.to_dict()

        estimation = self.estimation.value

        completed = []
        for completed_item_data in self.completed:
            completed_item = completed_item_data.to_dict()
            completed.append(completed_item)



        not_completed = []
        for not_completed_item_data in self.not_completed:
            not_completed_item = not_completed_item_data.to_dict()
            not_completed.append(not_completed_item)



        removed = []
        for removed_item_data in self.removed:
            removed_item = removed_item_data.to_dict()
            removed.append(removed_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprint": sprint,
            "estimation": estimation,
            "completed": completed,
            "notCompleted": not_completed,
            "removed": removed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sprint import Sprint # noqa: PLC0415
        from ..models.sprint_report_entry import SprintReportEntry # noqa: PLC0415
        d = dict(src_dict)
        sprint = Sprint.from_dict(d.pop("sprint"))




        estimation = SprintReportEstimation(d.pop("estimation"))




        completed = []
        _completed = d.pop("completed")
        for completed_item_data in (_completed):
            completed_item = SprintReportEntry.from_dict(completed_item_data)



            completed.append(completed_item)


        not_completed = []
        _not_completed = d.pop("notCompleted")
        for not_completed_item_data in (_not_completed):
            not_completed_item = SprintReportEntry.from_dict(not_completed_item_data)



            not_completed.append(not_completed_item)


        removed = []
        _removed = d.pop("removed")
        for removed_item_data in (_removed):
            removed_item = SprintReportEntry.from_dict(removed_item_data)



            removed.append(removed_item)


        sprint_report = cls(
            sprint=sprint,
            estimation=estimation,
            completed=completed,
            not_completed=not_completed,
            removed=removed,
        )

        return sprint_report

