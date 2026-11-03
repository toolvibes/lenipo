from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.plan_scenario_changes_item import PlanScenarioChangesItem





T = TypeVar("T", bound="PlanScenario")



@_attrs_define
class PlanScenario:
    """ 
        Attributes:
            id (UUID):
            name (str):
            changes (list[PlanScenarioChangesItem]):
     """

    id: UUID
    name: str
    changes: list[PlanScenarioChangesItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_scenario_changes_item import PlanScenarioChangesItem # noqa: PLC0415
        id = str(self.id)

        name = self.name

        changes = []
        for changes_item_data in self.changes:
            changes_item = changes_item_data.to_dict()
            changes.append(changes_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "changes": changes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_scenario_changes_item import PlanScenarioChangesItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        changes = []
        _changes = d.pop("changes")
        for changes_item_data in (_changes):
            changes_item = PlanScenarioChangesItem.from_dict(changes_item_data)



            changes.append(changes_item)


        plan_scenario = cls(
            id=id,
            name=name,
            changes=changes,
        )

        return plan_scenario

