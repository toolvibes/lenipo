from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_activity_kind import AgentActivityKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_activity_issue_type_0 import AgentActivityIssueType0





T = TypeVar("T", bound="AgentActivity")



@_attrs_define
class AgentActivity:
    """ 
        Attributes:
            at (datetime.datetime):
            kind (AgentActivityKind):
            issue (AgentActivityIssueType0 | None):
            title (str):
            status (int | None):
            ok (bool):
            detail (str):
     """

    at: datetime.datetime
    kind: AgentActivityKind
    issue: AgentActivityIssueType0 | None
    title: str
    status: int | None
    ok: bool
    detail: str





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_activity_issue_type_0 import AgentActivityIssueType0 # noqa: PLC0415
        at = self.at.isoformat()

        kind = self.kind.value

        issue: dict[str, Any] | None
        if isinstance(self.issue, AgentActivityIssueType0):
            issue = self.issue.to_dict()
        else:
            issue = self.issue

        title = self.title

        status: int | None
        status = self.status

        ok = self.ok

        detail = self.detail


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "at": at,
            "kind": kind,
            "issue": issue,
            "title": title,
            "status": status,
            "ok": ok,
            "detail": detail,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_activity_issue_type_0 import AgentActivityIssueType0 # noqa: PLC0415
        d = dict(src_dict)
        at = datetime.datetime.fromisoformat(d.pop("at"))




        kind = AgentActivityKind(d.pop("kind"))




        def _parse_issue(data: object) -> AgentActivityIssueType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                issue_type_0 = AgentActivityIssueType0.from_dict(data)



                return issue_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentActivityIssueType0 | None, data)

        issue = _parse_issue(d.pop("issue"))


        title = d.pop("title")

        def _parse_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        status = _parse_status(d.pop("status"))


        ok = d.pop("ok")

        detail = d.pop("detail")

        agent_activity = cls(
            at=at,
            kind=kind,
            issue=issue,
            title=title,
            status=status,
            ok=ok,
            detail=detail,
        )

        return agent_activity

