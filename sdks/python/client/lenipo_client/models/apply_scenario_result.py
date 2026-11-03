from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.apply_scenario_result_skipped_item import ApplyScenarioResultSkippedItem





T = TypeVar("T", bound="ApplyScenarioResult")



@_attrs_define
class ApplyScenarioResult:
    """ 
        Attributes:
            applied (list[str]):
            skipped (list[ApplyScenarioResultSkippedItem]):
     """

    applied: list[str]
    skipped: list[ApplyScenarioResultSkippedItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.apply_scenario_result_skipped_item import ApplyScenarioResultSkippedItem # noqa: PLC0415
        applied = self.applied



        skipped = []
        for skipped_item_data in self.skipped:
            skipped_item = skipped_item_data.to_dict()
            skipped.append(skipped_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "applied": applied,
            "skipped": skipped,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.apply_scenario_result_skipped_item import ApplyScenarioResultSkippedItem # noqa: PLC0415
        d = dict(src_dict)
        applied = cast(list[str], d.pop("applied"))


        skipped = []
        _skipped = d.pop("skipped")
        for skipped_item_data in (_skipped):
            skipped_item = ApplyScenarioResultSkippedItem.from_dict(skipped_item_data)



            skipped.append(skipped_item)


        apply_scenario_result = cls(
            applied=applied,
            skipped=skipped,
        )

        return apply_scenario_result

