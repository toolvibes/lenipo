from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.report_config_input_type_11_group_by import ReportConfigInputType11GroupBy
from ..models.report_config_input_type_11_period import ReportConfigInputType11Period
from ..types import UNSET, Unset
from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigInputType11")



@_attrs_define
class ReportConfigInputType11:
    """ 
        Attributes:
            kind (Literal['time-tracking']):
            query (str):
            days (int | Unset):  Default: 30.
            group_by (ReportConfigInputType11GroupBy | Unset):  Default: ReportConfigInputType11GroupBy.ISSUE.
            period (ReportConfigInputType11Period | Unset):  Default: ReportConfigInputType11Period.NONE.
     """

    kind: Literal['time-tracking']
    query: str
    days: int | Unset = 30
    group_by: ReportConfigInputType11GroupBy | Unset = ReportConfigInputType11GroupBy.ISSUE
    period: ReportConfigInputType11Period | Unset = ReportConfigInputType11Period.NONE
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        days = self.days

        group_by: str | Unset = UNSET
        if not isinstance(self.group_by, Unset):
            group_by = self.group_by.value


        period: str | Unset = UNSET
        if not isinstance(self.period, Unset):
            period = self.period.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "query": query,
        })
        if days is not UNSET:
            field_dict["days"] = days
        if group_by is not UNSET:
            field_dict["groupBy"] = group_by
        if period is not UNSET:
            field_dict["period"] = period

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['time-tracking'] , d.pop("kind"))
        if kind != 'time-tracking':
            raise ValueError(f"kind must match const 'time-tracking', got '{kind}'")

        query = d.pop("query")

        days = d.pop("days", UNSET)

        _group_by = d.pop("groupBy", UNSET)
        group_by: ReportConfigInputType11GroupBy | Unset
        if isinstance(_group_by,  Unset):
            group_by = UNSET
        else:
            group_by = ReportConfigInputType11GroupBy(_group_by)




        _period = d.pop("period", UNSET)
        period: ReportConfigInputType11Period | Unset
        if isinstance(_period,  Unset):
            period = UNSET
        else:
            period = ReportConfigInputType11Period(_period)




        report_config_input_type_11 = cls(
            kind=kind,
            query=query,
            days=days,
            group_by=group_by,
            period=period,
        )


        report_config_input_type_11.additional_properties = d
        return report_config_input_type_11

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
