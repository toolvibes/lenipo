from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="PageAnalyticsDailyItem")



@_attrs_define
class PageAnalyticsDailyItem:
    """ 
        Attributes:
            day (datetime.date):
            views (int):
            readers (int):
     """

    day: datetime.date
    views: int
    readers: int





    def to_dict(self) -> dict[str, Any]:
        day = self.day.isoformat()

        views = self.views

        readers = self.readers


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "day": day,
            "views": views,
            "readers": readers,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        day = datetime.date.fromisoformat(d.pop("day"))




        views = d.pop("views")

        readers = d.pop("readers")

        page_analytics_daily_item = cls(
            day=day,
            views=views,
            readers=readers,
        )

        return page_analytics_daily_item

