from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="PagePropertiesReportRowsItemPage")



@_attrs_define
class PagePropertiesReportRowsItemPage:
    """ 
        Attributes:
            id (UUID):
            title (str):
            space_key (str):
     """

    id: UUID
    title: str
    space_key: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        title = self.title

        space_key = self.space_key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "spaceKey": space_key,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        space_key = d.pop("spaceKey")

        page_properties_report_rows_item_page = cls(
            id=id,
            title=title,
            space_key=space_key,
        )

        return page_properties_report_rows_item_page

