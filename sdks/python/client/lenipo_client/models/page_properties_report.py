from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.page_properties_report_rows_item import PagePropertiesReportRowsItem





T = TypeVar("T", bound="PagePropertiesReport")



@_attrs_define
class PagePropertiesReport:
    """ 
        Attributes:
            keys (list[str]):
            rows (list[PagePropertiesReportRowsItem]):
     """

    keys: list[str]
    rows: list[PagePropertiesReportRowsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_properties_report_rows_item import PagePropertiesReportRowsItem # noqa: PLC0415
        keys = self.keys



        rows = []
        for rows_item_data in self.rows:
            rows_item = rows_item_data.to_dict()
            rows.append(rows_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "keys": keys,
            "rows": rows,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_properties_report_rows_item import PagePropertiesReportRowsItem # noqa: PLC0415
        d = dict(src_dict)
        keys = cast(list[str], d.pop("keys"))


        rows = []
        _rows = d.pop("rows")
        for rows_item_data in (_rows):
            rows_item = PagePropertiesReportRowsItem.from_dict(rows_item_data)



            rows.append(rows_item)


        page_properties_report = cls(
            keys=keys,
            rows=rows,
        )

        return page_properties_report

