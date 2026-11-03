from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.budget_limits_input import BudgetLimitsInput





T = TypeVar("T", bound="AgentBudgetInput")



@_attrs_define
class AgentBudgetInput:
    """ 
        Attributes:
            day (BudgetLimitsInput | Unset):
            month (BudgetLimitsInput | Unset):
     """

    day: BudgetLimitsInput | Unset = UNSET
    month: BudgetLimitsInput | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.budget_limits_input import BudgetLimitsInput # noqa: PLC0415
        day: dict[str, Any] | Unset = UNSET
        if not isinstance(self.day, Unset):
            day = self.day.to_dict()

        month: dict[str, Any] | Unset = UNSET
        if not isinstance(self.month, Unset):
            month = self.month.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if day is not UNSET:
            field_dict["day"] = day
        if month is not UNSET:
            field_dict["month"] = month

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.budget_limits_input import BudgetLimitsInput # noqa: PLC0415
        d = dict(src_dict)
        _day = d.pop("day", UNSET)
        day: BudgetLimitsInput | Unset
        if isinstance(_day,  Unset):
            day = UNSET
        else:
            day = BudgetLimitsInput.from_dict(_day)




        _month = d.pop("month", UNSET)
        month: BudgetLimitsInput | Unset
        if isinstance(_month,  Unset):
            month = UNSET
        else:
            month = BudgetLimitsInput.from_dict(_month)




        agent_budget_input = cls(
            day=day,
            month=month,
        )


        agent_budget_input.additional_properties = d
        return agent_budget_input

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
