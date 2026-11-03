from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TimeReportTotals")



@_attrs_define
class TimeReportTotals:
    """ 
        Attributes:
            original_estimate_seconds (int):
            time_spent_seconds (int):
            remaining_estimate_seconds (int):
            logged_seconds (int):
     """

    original_estimate_seconds: int
    time_spent_seconds: int
    remaining_estimate_seconds: int
    logged_seconds: int





    def to_dict(self) -> dict[str, Any]:
        original_estimate_seconds = self.original_estimate_seconds

        time_spent_seconds = self.time_spent_seconds

        remaining_estimate_seconds = self.remaining_estimate_seconds

        logged_seconds = self.logged_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "originalEstimateSeconds": original_estimate_seconds,
            "timeSpentSeconds": time_spent_seconds,
            "remainingEstimateSeconds": remaining_estimate_seconds,
            "loggedSeconds": logged_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        original_estimate_seconds = d.pop("originalEstimateSeconds")

        time_spent_seconds = d.pop("timeSpentSeconds")

        remaining_estimate_seconds = d.pop("remainingEstimateSeconds")

        logged_seconds = d.pop("loggedSeconds")

        time_report_totals = cls(
            original_estimate_seconds=original_estimate_seconds,
            time_spent_seconds=time_spent_seconds,
            remaining_estimate_seconds=remaining_estimate_seconds,
            logged_seconds=logged_seconds,
        )

        return time_report_totals

