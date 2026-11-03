from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TimesheetRowsItemIssueProject")



@_attrs_define
class TimesheetRowsItemIssueProject:
    """ 
        Attributes:
            key (str):
            name (str):
     """

    key: str
    name: str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        timesheet_rows_item_issue_project = cls(
            key=key,
            name=name,
        )

        return timesheet_rows_item_issue_project

