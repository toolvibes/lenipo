from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="TimesheetRowsItemCellsItem")



@_attrs_define
class TimesheetRowsItemCellsItem:
    """ 
        Attributes:
            date (datetime.date):
            seconds (int):
            worklog_ids (list[UUID]):
     """

    date: datetime.date
    seconds: int
    worklog_ids: list[UUID]





    def to_dict(self) -> dict[str, Any]:
        date = self.date.isoformat()

        seconds = self.seconds

        worklog_ids = []
        for worklog_ids_item_data in self.worklog_ids:
            worklog_ids_item = str(worklog_ids_item_data)
            worklog_ids.append(worklog_ids_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "date": date,
            "seconds": seconds,
            "worklogIds": worklog_ids,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        date = datetime.date.fromisoformat(d.pop("date"))




        seconds = d.pop("seconds")

        worklog_ids = []
        _worklog_ids = d.pop("worklogIds")
        for worklog_ids_item_data in (_worklog_ids):
            worklog_ids_item = UUID(worklog_ids_item_data)



            worklog_ids.append(worklog_ids_item)


        timesheet_rows_item_cells_item = cls(
            date=date,
            seconds=seconds,
            worklog_ids=worklog_ids,
        )

        return timesheet_rows_item_cells_item

