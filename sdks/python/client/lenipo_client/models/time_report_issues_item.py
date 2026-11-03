from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TimeReportIssuesItem")



@_attrs_define
class TimeReportIssuesItem:
    """ 
        Attributes:
            key (str):
            summary (str):
            original_estimate_seconds (int | None):
            time_spent_seconds (int):
            remaining_estimate_seconds (int | None):
            logged_seconds (int):
     """

    key: str
    summary: str
    original_estimate_seconds: int | None
    time_spent_seconds: int
    remaining_estimate_seconds: int | None
    logged_seconds: int





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        summary = self.summary

        original_estimate_seconds: int | None
        original_estimate_seconds = self.original_estimate_seconds

        time_spent_seconds = self.time_spent_seconds

        remaining_estimate_seconds: int | None
        remaining_estimate_seconds = self.remaining_estimate_seconds

        logged_seconds = self.logged_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "originalEstimateSeconds": original_estimate_seconds,
            "timeSpentSeconds": time_spent_seconds,
            "remainingEstimateSeconds": remaining_estimate_seconds,
            "loggedSeconds": logged_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        def _parse_original_estimate_seconds(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        original_estimate_seconds = _parse_original_estimate_seconds(d.pop("originalEstimateSeconds"))


        time_spent_seconds = d.pop("timeSpentSeconds")

        def _parse_remaining_estimate_seconds(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        remaining_estimate_seconds = _parse_remaining_estimate_seconds(d.pop("remainingEstimateSeconds"))


        logged_seconds = d.pop("loggedSeconds")

        time_report_issues_item = cls(
            key=key,
            summary=summary,
            original_estimate_seconds=original_estimate_seconds,
            time_spent_seconds=time_spent_seconds,
            remaining_estimate_seconds=remaining_estimate_seconds,
            logged_seconds=logged_seconds,
        )

        return time_report_issues_item

