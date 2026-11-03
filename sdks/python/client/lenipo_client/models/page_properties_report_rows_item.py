from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.page_properties_report_rows_item_page import PagePropertiesReportRowsItemPage
  from ..models.page_properties_report_rows_item_values import PagePropertiesReportRowsItemValues





T = TypeVar("T", bound="PagePropertiesReportRowsItem")



@_attrs_define
class PagePropertiesReportRowsItem:
    """ 
        Attributes:
            page (PagePropertiesReportRowsItemPage):
            values (PagePropertiesReportRowsItemValues):
     """

    page: PagePropertiesReportRowsItemPage
    values: PagePropertiesReportRowsItemValues





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_properties_report_rows_item_page import PagePropertiesReportRowsItemPage # noqa: PLC0415
        from ..models.page_properties_report_rows_item_values import PagePropertiesReportRowsItemValues # noqa: PLC0415
        page = self.page.to_dict()

        values = self.values.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "page": page,
            "values": values,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_properties_report_rows_item_page import PagePropertiesReportRowsItemPage # noqa: PLC0415
        from ..models.page_properties_report_rows_item_values import PagePropertiesReportRowsItemValues # noqa: PLC0415
        d = dict(src_dict)
        page = PagePropertiesReportRowsItemPage.from_dict(d.pop("page"))




        values = PagePropertiesReportRowsItemValues.from_dict(d.pop("values"))




        page_properties_report_rows_item = cls(
            page=page,
            values=values,
        )

        return page_properties_report_rows_item

