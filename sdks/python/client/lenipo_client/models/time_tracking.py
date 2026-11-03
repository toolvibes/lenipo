from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TimeTracking")



@_attrs_define
class TimeTracking:
    """ 
        Attributes:
            original_estimate_seconds (int | None):
            remaining_estimate_seconds (int | None):
            time_spent_seconds (int):
     """

    original_estimate_seconds: int | None
    remaining_estimate_seconds: int | None
    time_spent_seconds: int





    def to_dict(self) -> dict[str, Any]:
        original_estimate_seconds: int | None
        original_estimate_seconds = self.original_estimate_seconds

        remaining_estimate_seconds: int | None
        remaining_estimate_seconds = self.remaining_estimate_seconds

        time_spent_seconds = self.time_spent_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "originalEstimateSeconds": original_estimate_seconds,
            "remainingEstimateSeconds": remaining_estimate_seconds,
            "timeSpentSeconds": time_spent_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_original_estimate_seconds(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        original_estimate_seconds = _parse_original_estimate_seconds(d.pop("originalEstimateSeconds"))


        def _parse_remaining_estimate_seconds(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        remaining_estimate_seconds = _parse_remaining_estimate_seconds(d.pop("remainingEstimateSeconds"))


        time_spent_seconds = d.pop("timeSpentSeconds")

        time_tracking = cls(
            original_estimate_seconds=original_estimate_seconds,
            remaining_estimate_seconds=remaining_estimate_seconds,
            time_spent_seconds=time_spent_seconds,
        )

        return time_tracking

