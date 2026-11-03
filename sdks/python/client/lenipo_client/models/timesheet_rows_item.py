from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.timesheet_rows_item_cells_item import TimesheetRowsItemCellsItem
  from ..models.timesheet_rows_item_issue import TimesheetRowsItemIssue





T = TypeVar("T", bound="TimesheetRowsItem")



@_attrs_define
class TimesheetRowsItem:
    """ 
        Attributes:
            issue (TimesheetRowsItemIssue):
            cells (list[TimesheetRowsItemCellsItem]):
            total (int):
     """

    issue: TimesheetRowsItemIssue
    cells: list[TimesheetRowsItemCellsItem]
    total: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.timesheet_rows_item_cells_item import TimesheetRowsItemCellsItem # noqa: PLC0415
        from ..models.timesheet_rows_item_issue import TimesheetRowsItemIssue # noqa: PLC0415
        issue = self.issue.to_dict()

        cells = []
        for cells_item_data in self.cells:
            cells_item = cells_item_data.to_dict()
            cells.append(cells_item)



        total = self.total


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "cells": cells,
            "total": total,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.timesheet_rows_item_cells_item import TimesheetRowsItemCellsItem # noqa: PLC0415
        from ..models.timesheet_rows_item_issue import TimesheetRowsItemIssue # noqa: PLC0415
        d = dict(src_dict)
        issue = TimesheetRowsItemIssue.from_dict(d.pop("issue"))




        cells = []
        _cells = d.pop("cells")
        for cells_item_data in (_cells):
            cells_item = TimesheetRowsItemCellsItem.from_dict(cells_item_data)



            cells.append(cells_item)


        total = d.pop("total")

        timesheet_rows_item = cls(
            issue=issue,
            cells=cells,
            total=total,
        )

        return timesheet_rows_item

