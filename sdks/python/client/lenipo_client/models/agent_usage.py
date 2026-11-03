from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent_budget import AgentBudget
  from ..models.agent_pause import AgentPause
  from ..models.budget_usage import BudgetUsage





T = TypeVar("T", bound="AgentUsage")



@_attrs_define
class AgentUsage:
    """ 
        Attributes:
            day (BudgetUsage):
            month (BudgetUsage):
            budget (AgentBudget):
            paused (AgentPause | None):
            exceeded (list[str]):
     """

    day: BudgetUsage
    month: BudgetUsage
    budget: AgentBudget
    paused: AgentPause | None
    exceeded: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_budget import AgentBudget # noqa: PLC0415
        from ..models.agent_pause import AgentPause # noqa: PLC0415
        from ..models.budget_usage import BudgetUsage # noqa: PLC0415
        day = self.day.to_dict()

        month = self.month.to_dict()

        budget = self.budget.to_dict()

        paused: dict[str, Any] | None
        if isinstance(self.paused, AgentPause):
            paused = self.paused.to_dict()
        else:
            paused = self.paused

        exceeded = self.exceeded




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "day": day,
            "month": month,
            "budget": budget,
            "paused": paused,
            "exceeded": exceeded,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_budget import AgentBudget # noqa: PLC0415
        from ..models.agent_pause import AgentPause # noqa: PLC0415
        from ..models.budget_usage import BudgetUsage # noqa: PLC0415
        d = dict(src_dict)
        day = BudgetUsage.from_dict(d.pop("day"))




        month = BudgetUsage.from_dict(d.pop("month"))




        budget = AgentBudget.from_dict(d.pop("budget"))




        def _parse_paused(data: object) -> AgentPause | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                paused_type_0 = AgentPause.from_dict(data)



                return paused_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentPause | None, data)

        paused = _parse_paused(d.pop("paused"))


        exceeded = cast(list[str], d.pop("exceeded"))


        agent_usage = cls(
            day=day,
            month=month,
            budget=budget,
            paused=paused,
            exceeded=exceeded,
        )

        return agent_usage

