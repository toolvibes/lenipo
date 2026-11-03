from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SlaMetric")



@_attrs_define
class SlaMetric:
    """ 
        Attributes:
            target_hours (float):
            elapsed_hours (float):
            remaining_hours (float):
            breached (bool):
            stopped (bool):
            paused (bool):
     """

    target_hours: float
    elapsed_hours: float
    remaining_hours: float
    breached: bool
    stopped: bool
    paused: bool





    def to_dict(self) -> dict[str, Any]:
        target_hours = self.target_hours

        elapsed_hours = self.elapsed_hours

        remaining_hours = self.remaining_hours

        breached = self.breached

        stopped = self.stopped

        paused = self.paused


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "targetHours": target_hours,
            "elapsedHours": elapsed_hours,
            "remainingHours": remaining_hours,
            "breached": breached,
            "stopped": stopped,
            "paused": paused,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        target_hours = d.pop("targetHours")

        elapsed_hours = d.pop("elapsedHours")

        remaining_hours = d.pop("remainingHours")

        breached = d.pop("breached")

        stopped = d.pop("stopped")

        paused = d.pop("paused")

        sla_metric = cls(
            target_hours=target_hours,
            elapsed_hours=elapsed_hours,
            remaining_hours=remaining_hours,
            breached=breached,
            stopped=stopped,
            paused=paused,
        )

        return sla_metric

