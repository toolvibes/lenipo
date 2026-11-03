from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.time_pivot_request_group_by import TimePivotRequestGroupBy
from ..models.time_pivot_request_period import TimePivotRequestPeriod
from ..types import UNSET, Unset
from typing import cast
import datetime






T = TypeVar("T", bound="TimePivotRequest")



@_attrs_define
class TimePivotRequest:
    """ 
        Attributes:
            query (str):
            from_ (datetime.date):
            to (datetime.date):
            group_by (TimePivotRequestGroupBy | Unset):  Default: TimePivotRequestGroupBy.PERSON.
            period (TimePivotRequestPeriod | Unset):  Default: TimePivotRequestPeriod.WEEK.
     """

    query: str
    from_: datetime.date
    to: datetime.date
    group_by: TimePivotRequestGroupBy | Unset = TimePivotRequestGroupBy.PERSON
    period: TimePivotRequestPeriod | Unset = TimePivotRequestPeriod.WEEK
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        query = self.query

        from_ = self.from_.isoformat()

        to = self.to.isoformat()

        group_by: str | Unset = UNSET
        if not isinstance(self.group_by, Unset):
            group_by = self.group_by.value


        period: str | Unset = UNSET
        if not isinstance(self.period, Unset):
            period = self.period.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "query": query,
            "from": from_,
            "to": to,
        })
        if group_by is not UNSET:
            field_dict["groupBy"] = group_by
        if period is not UNSET:
            field_dict["period"] = period

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        query = d.pop("query")

        from_ = datetime.date.fromisoformat(d.pop("from"))




        to = datetime.date.fromisoformat(d.pop("to"))




        _group_by = d.pop("groupBy", UNSET)
        group_by: TimePivotRequestGroupBy | Unset
        if isinstance(_group_by,  Unset):
            group_by = UNSET
        else:
            group_by = TimePivotRequestGroupBy(_group_by)




        _period = d.pop("period", UNSET)
        period: TimePivotRequestPeriod | Unset
        if isinstance(_period,  Unset):
            period = UNSET
        else:
            period = TimePivotRequestPeriod(_period)




        time_pivot_request = cls(
            query=query,
            from_=from_,
            to=to,
            group_by=group_by,
            period=period,
        )


        time_pivot_request.additional_properties = d
        return time_pivot_request

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
