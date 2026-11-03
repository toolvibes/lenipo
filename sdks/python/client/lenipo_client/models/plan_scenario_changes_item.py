from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.scenario_change import ScenarioChange





T = TypeVar("T", bound="PlanScenarioChangesItem")



@_attrs_define
class PlanScenarioChangesItem:
    """ 
        Attributes:
            key (str):
            change (ScenarioChange):
     """

    key: str
    change: ScenarioChange





    def to_dict(self) -> dict[str, Any]:
        from ..models.scenario_change import ScenarioChange # noqa: PLC0415
        key = self.key

        change = self.change.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "change": change,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.scenario_change import ScenarioChange # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        change = ScenarioChange.from_dict(d.pop("change"))




        plan_scenario_changes_item = cls(
            key=key,
            change=change,
        )

        return plan_scenario_changes_item

