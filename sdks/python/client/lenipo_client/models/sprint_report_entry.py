from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary





T = TypeVar("T", bound="SprintReportEntry")



@_attrs_define
class SprintReportEntry:
    """ 
        Attributes:
            issue (IssueSummary):
            estimate (float | None):
            added_after_start (bool):
     """

    issue: IssueSummary
    estimate: float | None
    added_after_start: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        issue = self.issue.to_dict()

        estimate: float | None
        estimate = self.estimate

        added_after_start = self.added_after_start


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "estimate": estimate,
            "addedAfterStart": added_after_start,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        d = dict(src_dict)
        issue = IssueSummary.from_dict(d.pop("issue"))




        def _parse_estimate(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        estimate = _parse_estimate(d.pop("estimate"))


        added_after_start = d.pop("addedAfterStart")

        sprint_report_entry = cls(
            issue=issue,
            estimate=estimate,
            added_after_start=added_after_start,
        )

        return sprint_report_entry

