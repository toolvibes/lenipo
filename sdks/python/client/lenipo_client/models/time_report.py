from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.time_report_issues_item import TimeReportIssuesItem
  from ..models.time_report_people_item import TimeReportPeopleItem
  from ..models.time_report_totals import TimeReportTotals





T = TypeVar("T", bound="TimeReport")



@_attrs_define
class TimeReport:
    """ 
        Attributes:
            issues (list[TimeReportIssuesItem]):
            people (list[TimeReportPeopleItem]):
            totals (TimeReportTotals):
            truncated (bool):
     """

    issues: list[TimeReportIssuesItem]
    people: list[TimeReportPeopleItem]
    totals: TimeReportTotals
    truncated: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.time_report_issues_item import TimeReportIssuesItem # noqa: PLC0415
        from ..models.time_report_people_item import TimeReportPeopleItem # noqa: PLC0415
        from ..models.time_report_totals import TimeReportTotals # noqa: PLC0415
        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        people = []
        for people_item_data in self.people:
            people_item = people_item_data.to_dict()
            people.append(people_item)



        totals = self.totals.to_dict()

        truncated = self.truncated


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "people": people,
            "totals": totals,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.time_report_issues_item import TimeReportIssuesItem # noqa: PLC0415
        from ..models.time_report_people_item import TimeReportPeopleItem # noqa: PLC0415
        from ..models.time_report_totals import TimeReportTotals # noqa: PLC0415
        d = dict(src_dict)
        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = TimeReportIssuesItem.from_dict(issues_item_data)



            issues.append(issues_item)


        people = []
        _people = d.pop("people")
        for people_item_data in (_people):
            people_item = TimeReportPeopleItem.from_dict(people_item_data)



            people.append(people_item)


        totals = TimeReportTotals.from_dict(d.pop("totals"))




        truncated = d.pop("truncated")

        time_report = cls(
            issues=issues,
            people=people,
            totals=totals,
            truncated=truncated,
        )

        return time_report

