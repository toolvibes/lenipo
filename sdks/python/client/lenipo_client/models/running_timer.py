from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.running_timer_issue import RunningTimerIssue





T = TypeVar("T", bound="RunningTimer")



@_attrs_define
class RunningTimer:
    """ 
        Attributes:
            issue (RunningTimerIssue):
            started_at (datetime.datetime):
     """

    issue: RunningTimerIssue
    started_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.running_timer_issue import RunningTimerIssue # noqa: PLC0415
        issue = self.issue.to_dict()

        started_at = self.started_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "startedAt": started_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.running_timer_issue import RunningTimerIssue # noqa: PLC0415
        d = dict(src_dict)
        issue = RunningTimerIssue.from_dict(d.pop("issue"))




        started_at = datetime.datetime.fromisoformat(d.pop("startedAt"))




        running_timer = cls(
            issue=issue,
            started_at=started_at,
        )

        return running_timer

