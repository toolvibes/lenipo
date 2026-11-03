from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="BudgetLimits")



@_attrs_define
class BudgetLimits:
    """ 
        Attributes:
            issues (int | None):
            minutes (int | None):
            cost (float | None):
     """

    issues: int | None
    minutes: int | None
    cost: float | None





    def to_dict(self) -> dict[str, Any]:
        issues: int | None
        issues = self.issues

        minutes: int | None
        minutes = self.minutes

        cost: float | None
        cost = self.cost


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "minutes": minutes,
            "cost": cost,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_issues(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        issues = _parse_issues(d.pop("issues"))


        def _parse_minutes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        minutes = _parse_minutes(d.pop("minutes"))


        def _parse_cost(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        cost = _parse_cost(d.pop("cost"))


        budget_limits = cls(
            issues=issues,
            minutes=minutes,
            cost=cost,
        )

        return budget_limits

