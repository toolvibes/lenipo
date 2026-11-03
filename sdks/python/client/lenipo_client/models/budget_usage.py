from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="BudgetUsage")



@_attrs_define
class BudgetUsage:
    """ 
        Attributes:
            issues (int):
            minutes (int):
            cost (float):
     """

    issues: int
    minutes: int
    cost: float





    def to_dict(self) -> dict[str, Any]:
        issues = self.issues

        minutes = self.minutes

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
        issues = d.pop("issues")

        minutes = d.pop("minutes")

        cost = d.pop("cost")

        budget_usage = cls(
            issues=issues,
            minutes=minutes,
            cost=cost,
        )

        return budget_usage

