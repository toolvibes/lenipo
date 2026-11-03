from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.report_config_type_11_group_by import ReportConfigType11GroupBy
from ..models.report_config_type_11_period import ReportConfigType11Period
from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigType11")



@_attrs_define
class ReportConfigType11:
    """ 
        Attributes:
            kind (Literal['time-tracking']):
            query (str):
            days (int):  Default: 30.
            group_by (ReportConfigType11GroupBy):  Default: ReportConfigType11GroupBy.ISSUE.
            period (ReportConfigType11Period):  Default: ReportConfigType11Period.NONE.
     """

    kind: Literal['time-tracking']
    query: str
    days: int = 30
    group_by: ReportConfigType11GroupBy = ReportConfigType11GroupBy.ISSUE
    period: ReportConfigType11Period = ReportConfigType11Period.NONE





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        days = self.days

        group_by = self.group_by.value

        period = self.period.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "query": query,
            "days": days,
            "groupBy": group_by,
            "period": period,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['time-tracking'] , d.pop("kind"))
        if kind != 'time-tracking':
            raise ValueError(f"kind must match const 'time-tracking', got '{kind}'")

        query = d.pop("query")

        days = d.pop("days")

        group_by = ReportConfigType11GroupBy(d.pop("groupBy"))




        period = ReportConfigType11Period(d.pop("period"))




        report_config_type_11 = cls(
            kind=kind,
            query=query,
            days=days,
            group_by=group_by,
            period=period,
        )

        return report_config_type_11

