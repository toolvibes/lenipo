from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="BudgetLimitsInput")



@_attrs_define
class BudgetLimitsInput:
    """ 
        Attributes:
            issues (int | None | Unset):
            minutes (int | None | Unset):
            cost (float | None | Unset):
     """

    issues: int | None | Unset = UNSET
    minutes: int | None | Unset = UNSET
    cost: float | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        issues: int | None | Unset
        if isinstance(self.issues, Unset):
            issues = UNSET
        else:
            issues = self.issues

        minutes: int | None | Unset
        if isinstance(self.minutes, Unset):
            minutes = UNSET
        else:
            minutes = self.minutes

        cost: float | None | Unset
        if isinstance(self.cost, Unset):
            cost = UNSET
        else:
            cost = self.cost


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if issues is not UNSET:
            field_dict["issues"] = issues
        if minutes is not UNSET:
            field_dict["minutes"] = minutes
        if cost is not UNSET:
            field_dict["cost"] = cost

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_issues(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        issues = _parse_issues(d.pop("issues", UNSET))


        def _parse_minutes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        minutes = _parse_minutes(d.pop("minutes", UNSET))


        def _parse_cost(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        cost = _parse_cost(d.pop("cost", UNSET))


        budget_limits_input = cls(
            issues=issues,
            minutes=minutes,
            cost=cost,
        )


        budget_limits_input.additional_properties = d
        return budget_limits_input

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
