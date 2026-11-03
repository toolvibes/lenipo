from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.budget_limits import BudgetLimits





T = TypeVar("T", bound="AgentBudget")



@_attrs_define
class AgentBudget:
    """ 
        Attributes:
            day (BudgetLimits):
            month (BudgetLimits):
     """

    day: BudgetLimits
    month: BudgetLimits





    def to_dict(self) -> dict[str, Any]:
        from ..models.budget_limits import BudgetLimits # noqa: PLC0415
        day = self.day.to_dict()

        month = self.month.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "day": day,
            "month": month,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.budget_limits import BudgetLimits # noqa: PLC0415
        d = dict(src_dict)
        day = BudgetLimits.from_dict(d.pop("day"))




        month = BudgetLimits.from_dict(d.pop("month"))




        agent_budget = cls(
            day=day,
            month=month,
        )

        return agent_budget

