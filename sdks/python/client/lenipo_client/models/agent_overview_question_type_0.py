from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_overview_question_type_0_state import AgentOverviewQuestionType0State
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_overview_question_type_0_issue_type_0 import AgentOverviewQuestionType0IssueType0





T = TypeVar("T", bound="AgentOverviewQuestionType0")



@_attrs_define
class AgentOverviewQuestionType0:
    """ 
        Attributes:
            state (AgentOverviewQuestionType0State):
            issue (AgentOverviewQuestionType0IssueType0 | None):
            note (str):
            since (datetime.datetime):
     """

    state: AgentOverviewQuestionType0State
    issue: AgentOverviewQuestionType0IssueType0 | None
    note: str
    since: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_overview_question_type_0_issue_type_0 import AgentOverviewQuestionType0IssueType0 # noqa: PLC0415
        state = self.state.value

        issue: dict[str, Any] | None
        if isinstance(self.issue, AgentOverviewQuestionType0IssueType0):
            issue = self.issue.to_dict()
        else:
            issue = self.issue

        note = self.note

        since = self.since.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "state": state,
            "issue": issue,
            "note": note,
            "since": since,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_overview_question_type_0_issue_type_0 import AgentOverviewQuestionType0IssueType0 # noqa: PLC0415
        d = dict(src_dict)
        state = AgentOverviewQuestionType0State(d.pop("state"))




        def _parse_issue(data: object) -> AgentOverviewQuestionType0IssueType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                issue_type_0 = AgentOverviewQuestionType0IssueType0.from_dict(data)



                return issue_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentOverviewQuestionType0IssueType0 | None, data)

        issue = _parse_issue(d.pop("issue"))


        note = d.pop("note")

        since = datetime.datetime.fromisoformat(d.pop("since"))




        agent_overview_question_type_0 = cls(
            state=state,
            issue=issue,
            note=note,
            since=since,
        )

        return agent_overview_question_type_0

