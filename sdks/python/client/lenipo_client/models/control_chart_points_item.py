from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="ControlChartPointsItem")



@_attrs_define
class ControlChartPointsItem:
    """ 
        Attributes:
            key (str):
            summary (str):
            resolved_at (datetime.datetime):
            lead_days (float):
            cycle_days (float | None):
     """

    key: str
    summary: str
    resolved_at: datetime.datetime
    lead_days: float
    cycle_days: float | None





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        summary = self.summary

        resolved_at = self.resolved_at.isoformat()

        lead_days = self.lead_days

        cycle_days: float | None
        cycle_days = self.cycle_days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "resolvedAt": resolved_at,
            "leadDays": lead_days,
            "cycleDays": cycle_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        resolved_at = datetime.datetime.fromisoformat(d.pop("resolvedAt"))




        lead_days = d.pop("leadDays")

        def _parse_cycle_days(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        cycle_days = _parse_cycle_days(d.pop("cycleDays"))


        control_chart_points_item = cls(
            key=key,
            summary=summary,
            resolved_at=resolved_at,
            lead_days=lead_days,
            cycle_days=cycle_days,
        )

        return control_chart_points_item

