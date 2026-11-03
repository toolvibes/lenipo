from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.time_pivot_rows_item import TimePivotRowsItem





T = TypeVar("T", bound="TimePivot")



@_attrs_define
class TimePivot:
    """ 
        Attributes:
            columns (list[str]):
            rows (list[TimePivotRowsItem]):
            totals (list[int]):
            total (int):
     """

    columns: list[str]
    rows: list[TimePivotRowsItem]
    totals: list[int]
    total: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.time_pivot_rows_item import TimePivotRowsItem # noqa: PLC0415
        columns = self.columns



        rows = []
        for rows_item_data in self.rows:
            rows_item = rows_item_data.to_dict()
            rows.append(rows_item)



        totals = self.totals



        total = self.total


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "columns": columns,
            "rows": rows,
            "totals": totals,
            "total": total,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.time_pivot_rows_item import TimePivotRowsItem # noqa: PLC0415
        d = dict(src_dict)
        columns = cast(list[str], d.pop("columns"))


        rows = []
        _rows = d.pop("rows")
        for rows_item_data in (_rows):
            rows_item = TimePivotRowsItem.from_dict(rows_item_data)



            rows.append(rows_item)


        totals = cast(list[int], d.pop("totals"))


        total = d.pop("total")

        time_pivot = cls(
            columns=columns,
            rows=rows,
            totals=totals,
            total=total,
        )

        return time_pivot

