from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.automation_run_status import AutomationRunStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.automation_run_log_item import AutomationRunLogItem





T = TypeVar("T", bound="AutomationRun")



@_attrs_define
class AutomationRun:
    """ 
        Attributes:
            id (UUID):
            started_at (datetime.datetime):
            duration_ms (int):
            status (AutomationRunStatus):
            trigger (str):
            issue_key (None | str):
            log (list[AutomationRunLogItem]):
     """

    id: UUID
    started_at: datetime.datetime
    duration_ms: int
    status: AutomationRunStatus
    trigger: str
    issue_key: None | str
    log: list[AutomationRunLogItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.automation_run_log_item import AutomationRunLogItem # noqa: PLC0415
        id = str(self.id)

        started_at = self.started_at.isoformat()

        duration_ms = self.duration_ms

        status = self.status.value

        trigger = self.trigger

        issue_key: None | str
        issue_key = self.issue_key

        log = []
        for log_item_data in self.log:
            log_item = log_item_data.to_dict()
            log.append(log_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "startedAt": started_at,
            "durationMs": duration_ms,
            "status": status,
            "trigger": trigger,
            "issueKey": issue_key,
            "log": log,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.automation_run_log_item import AutomationRunLogItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        started_at = datetime.datetime.fromisoformat(d.pop("startedAt"))




        duration_ms = d.pop("durationMs")

        status = AutomationRunStatus(d.pop("status"))




        trigger = d.pop("trigger")

        def _parse_issue_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        issue_key = _parse_issue_key(d.pop("issueKey"))


        log = []
        _log = d.pop("log")
        for log_item_data in (_log):
            log_item = AutomationRunLogItem.from_dict(log_item_data)



            log.append(log_item)


        automation_run = cls(
            id=id,
            started_at=started_at,
            duration_ms=duration_ms,
            status=status,
            trigger=trigger,
            issue_key=issue_key,
            log=log,
        )

        return automation_run

