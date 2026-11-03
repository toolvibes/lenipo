from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.issue_sla import IssueSla
  from ..models.status_info import StatusInfo
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="QueueEntry")



@_attrs_define
class QueueEntry:
    """ 
        Attributes:
            key (str):
            summary (str):
            status (StatusInfo):
            request_type (str):
            reporter (None | UserRef):
            assignee (None | UserRef):
            priority (str):
            created_at (datetime.datetime):
            sla (IssueSla):
     """

    key: str
    summary: str
    status: StatusInfo
    request_type: str
    reporter: None | UserRef
    assignee: None | UserRef
    priority: str
    created_at: datetime.datetime
    sla: IssueSla





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_sla import IssueSla # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        key = self.key

        summary = self.summary

        status = self.status.to_dict()

        request_type = self.request_type

        reporter: dict[str, Any] | None
        if isinstance(self.reporter, UserRef):
            reporter = self.reporter.to_dict()
        else:
            reporter = self.reporter

        assignee: dict[str, Any] | None
        if isinstance(self.assignee, UserRef):
            assignee = self.assignee.to_dict()
        else:
            assignee = self.assignee

        priority = self.priority

        created_at = self.created_at.isoformat()

        sla = self.sla.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "status": status,
            "requestType": request_type,
            "reporter": reporter,
            "assignee": assignee,
            "priority": priority,
            "createdAt": created_at,
            "sla": sla,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_sla import IssueSla # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        status = StatusInfo.from_dict(d.pop("status"))




        request_type = d.pop("requestType")

        def _parse_reporter(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                reporter_type_0 = UserRef.from_dict(data)



                return reporter_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        reporter = _parse_reporter(d.pop("reporter"))


        def _parse_assignee(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                assignee_type_0 = UserRef.from_dict(data)



                return assignee_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        assignee = _parse_assignee(d.pop("assignee"))


        priority = d.pop("priority")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        sla = IssueSla.from_dict(d.pop("sla"))




        queue_entry = cls(
            key=key,
            summary=summary,
            status=status,
            request_type=request_type,
            reporter=reporter,
            assignee=assignee,
            priority=priority,
            created_at=created_at,
            sla=sla,
        )

        return queue_entry

