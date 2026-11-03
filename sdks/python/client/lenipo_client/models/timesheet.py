from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.timesheet_rows_item import TimesheetRowsItem
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Timesheet")



@_attrs_define
class Timesheet:
    """ 
        Attributes:
            user (UserRef):
            week (datetime.date):
            days (list[datetime.date]):
            rows (list[TimesheetRowsItem]):
            day_totals (list[int]):
            total (int):
            editable (bool):
     """

    user: UserRef
    week: datetime.date
    days: list[datetime.date]
    rows: list[TimesheetRowsItem]
    day_totals: list[int]
    total: int
    editable: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.timesheet_rows_item import TimesheetRowsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        user = self.user.to_dict()

        week = self.week.isoformat()

        days = []
        for days_item_data in self.days:
            days_item = days_item_data.isoformat()
            days.append(days_item)



        rows = []
        for rows_item_data in self.rows:
            rows_item = rows_item_data.to_dict()
            rows.append(rows_item)



        day_totals = self.day_totals



        total = self.total

        editable = self.editable


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user": user,
            "week": week,
            "days": days,
            "rows": rows,
            "dayTotals": day_totals,
            "total": total,
            "editable": editable,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.timesheet_rows_item import TimesheetRowsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        user = UserRef.from_dict(d.pop("user"))




        week = datetime.date.fromisoformat(d.pop("week"))




        days = []
        _days = d.pop("days")
        for days_item_data in (_days):
            days_item = datetime.date.fromisoformat(days_item_data)



            days.append(days_item)


        rows = []
        _rows = d.pop("rows")
        for rows_item_data in (_rows):
            rows_item = TimesheetRowsItem.from_dict(rows_item_data)



            rows.append(rows_item)


        day_totals = cast(list[int], d.pop("dayTotals"))


        total = d.pop("total")

        editable = d.pop("editable")

        timesheet = cls(
            user=user,
            week=week,
            days=days,
            rows=rows,
            day_totals=day_totals,
            total=total,
            editable=editable,
        )

        return timesheet

