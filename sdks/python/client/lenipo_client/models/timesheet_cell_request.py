from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="TimesheetCellRequest")



@_attrs_define
class TimesheetCellRequest:
    """ 
        Attributes:
            issue_key (str):
            date (datetime.date):
            seconds (int):
     """

    issue_key: str
    date: datetime.date
    seconds: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        issue_key = self.issue_key

        date = self.date.isoformat()

        seconds = self.seconds


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "issueKey": issue_key,
            "date": date,
            "seconds": seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issue_key = d.pop("issueKey")

        date = datetime.date.fromisoformat(d.pop("date"))




        seconds = d.pop("seconds")

        timesheet_cell_request = cls(
            issue_key=issue_key,
            date=date,
            seconds=seconds,
        )


        timesheet_cell_request.additional_properties = d
        return timesheet_cell_request

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
