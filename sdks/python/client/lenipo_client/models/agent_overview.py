from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent import Agent
  from ..models.agent_overview_question_type_0 import AgentOverviewQuestionType0
  from ..models.agent_usage import AgentUsage
  from ..models.presence import Presence





T = TypeVar("T", bound="AgentOverview")



@_attrs_define
class AgentOverview:
    """ 
        Attributes:
            agent (Agent):
            presence (Presence):
            usage (AgentUsage):
            throughput (int):
            failures (int):
            question (AgentOverviewQuestionType0 | None):
     """

    agent: Agent
    presence: Presence
    usage: AgentUsage
    throughput: int
    failures: int
    question: AgentOverviewQuestionType0 | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent import Agent # noqa: PLC0415
        from ..models.agent_overview_question_type_0 import AgentOverviewQuestionType0 # noqa: PLC0415
        from ..models.agent_usage import AgentUsage # noqa: PLC0415
        from ..models.presence import Presence # noqa: PLC0415
        agent = self.agent.to_dict()

        presence = self.presence.to_dict()

        usage = self.usage.to_dict()

        throughput = self.throughput

        failures = self.failures

        question: dict[str, Any] | None
        if isinstance(self.question, AgentOverviewQuestionType0):
            question = self.question.to_dict()
        else:
            question = self.question


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent": agent,
            "presence": presence,
            "usage": usage,
            "throughput": throughput,
            "failures": failures,
            "question": question,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent import Agent # noqa: PLC0415
        from ..models.agent_overview_question_type_0 import AgentOverviewQuestionType0 # noqa: PLC0415
        from ..models.agent_usage import AgentUsage # noqa: PLC0415
        from ..models.presence import Presence # noqa: PLC0415
        d = dict(src_dict)
        agent = Agent.from_dict(d.pop("agent"))




        presence = Presence.from_dict(d.pop("presence"))




        usage = AgentUsage.from_dict(d.pop("usage"))




        throughput = d.pop("throughput")

        failures = d.pop("failures")

        def _parse_question(data: object) -> AgentOverviewQuestionType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                question_type_0 = AgentOverviewQuestionType0.from_dict(data)



                return question_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentOverviewQuestionType0 | None, data)

        question = _parse_question(d.pop("question"))


        agent_overview = cls(
            agent=agent,
            presence=presence,
            usage=usage,
            throughput=throughput,
            failures=failures,
            question=question,
        )

        return agent_overview

