from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.timesheet_rows_item_issue_project import TimesheetRowsItemIssueProject





T = TypeVar("T", bound="TimesheetRowsItemIssue")



@_attrs_define
class TimesheetRowsItemIssue:
    """ 
        Attributes:
            key (str):
            summary (str):
            project (TimesheetRowsItemIssueProject):
     """

    key: str
    summary: str
    project: TimesheetRowsItemIssueProject





    def to_dict(self) -> dict[str, Any]:
        from ..models.timesheet_rows_item_issue_project import TimesheetRowsItemIssueProject # noqa: PLC0415
        key = self.key

        summary = self.summary

        project = self.project.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "project": project,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.timesheet_rows_item_issue_project import TimesheetRowsItemIssueProject # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        project = TimesheetRowsItemIssueProject.from_dict(d.pop("project"))




        timesheet_rows_item_issue = cls(
            key=key,
            summary=summary,
            project=project,
        )

        return timesheet_rows_item_issue

