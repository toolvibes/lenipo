from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.apply_scenario_result_skipped_item_reason import ApplyScenarioResultSkippedItemReason






T = TypeVar("T", bound="ApplyScenarioResultSkippedItem")



@_attrs_define
class ApplyScenarioResultSkippedItem:
    """ 
        Attributes:
            key (str):
            reason (ApplyScenarioResultSkippedItemReason):
     """

    key: str
    reason: ApplyScenarioResultSkippedItemReason





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        reason = self.reason.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        reason = ApplyScenarioResultSkippedItemReason(d.pop("reason"))




        apply_scenario_result_skipped_item = cls(
            key=key,
            reason=reason,
        )

        return apply_scenario_result_skipped_item

