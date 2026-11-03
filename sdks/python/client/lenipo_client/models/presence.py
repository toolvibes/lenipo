from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.presence_state import PresenceState
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.presence_issue_type_0 import PresenceIssueType0





T = TypeVar("T", bound="Presence")



@_attrs_define
class Presence:
    """ 
        Attributes:
            state (PresenceState):
            issue (None | PresenceIssueType0):
            branch (None | str):
            note (str):
            heartbeat_at (datetime.datetime | None):
     """

    state: PresenceState
    issue: None | PresenceIssueType0
    branch: None | str
    note: str
    heartbeat_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.presence_issue_type_0 import PresenceIssueType0 # noqa: PLC0415
        state = self.state.value

        issue: dict[str, Any] | None
        if isinstance(self.issue, PresenceIssueType0):
            issue = self.issue.to_dict()
        else:
            issue = self.issue

        branch: None | str
        branch = self.branch

        note = self.note

        heartbeat_at: None | str
        if isinstance(self.heartbeat_at, datetime.datetime):
            heartbeat_at = self.heartbeat_at.isoformat()
        else:
            heartbeat_at = self.heartbeat_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "state": state,
            "issue": issue,
            "branch": branch,
            "note": note,
            "heartbeatAt": heartbeat_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.presence_issue_type_0 import PresenceIssueType0 # noqa: PLC0415
        d = dict(src_dict)
        state = PresenceState(d.pop("state"))




        def _parse_issue(data: object) -> None | PresenceIssueType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                issue_type_0 = PresenceIssueType0.from_dict(data)



                return issue_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PresenceIssueType0, data)

        issue = _parse_issue(d.pop("issue"))


        def _parse_branch(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        branch = _parse_branch(d.pop("branch"))


        note = d.pop("note")

        def _parse_heartbeat_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                heartbeat_at_type_0 = datetime.datetime.fromisoformat(data)



                return heartbeat_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        heartbeat_at = _parse_heartbeat_at(d.pop("heartbeatAt"))


        presence = cls(
            state=state,
            issue=issue,
            branch=branch,
            note=note,
            heartbeat_at=heartbeat_at,
        )

        return presence

