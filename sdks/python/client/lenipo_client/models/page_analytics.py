from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.page_analytics_daily_item import PageAnalyticsDailyItem
  from ..models.page_analytics_reader_list_type_0_item import PageAnalyticsReaderListType0Item





T = TypeVar("T", bound="PageAnalytics")



@_attrs_define
class PageAnalytics:
    """ 
        Attributes:
            days (int):
            views (int):
            readers (int):
            daily (list[PageAnalyticsDailyItem]):
            reader_list (list[PageAnalyticsReaderListType0Item] | None):
     """

    days: int
    views: int
    readers: int
    daily: list[PageAnalyticsDailyItem]
    reader_list: list[PageAnalyticsReaderListType0Item] | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_analytics_daily_item import PageAnalyticsDailyItem # noqa: PLC0415
        from ..models.page_analytics_reader_list_type_0_item import PageAnalyticsReaderListType0Item # noqa: PLC0415
        days = self.days

        views = self.views

        readers = self.readers

        daily = []
        for daily_item_data in self.daily:
            daily_item = daily_item_data.to_dict()
            daily.append(daily_item)



        reader_list: list[dict[str, Any]] | None
        if isinstance(self.reader_list, list):
            reader_list = []
            for reader_list_type_0_item_data in self.reader_list:
                reader_list_type_0_item = reader_list_type_0_item_data.to_dict()
                reader_list.append(reader_list_type_0_item)


        else:
            reader_list = self.reader_list


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "days": days,
            "views": views,
            "readers": readers,
            "daily": daily,
            "readerList": reader_list,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_analytics_daily_item import PageAnalyticsDailyItem # noqa: PLC0415
        from ..models.page_analytics_reader_list_type_0_item import PageAnalyticsReaderListType0Item # noqa: PLC0415
        d = dict(src_dict)
        days = d.pop("days")

        views = d.pop("views")

        readers = d.pop("readers")

        daily = []
        _daily = d.pop("daily")
        for daily_item_data in (_daily):
            daily_item = PageAnalyticsDailyItem.from_dict(daily_item_data)



            daily.append(daily_item)


        def _parse_reader_list(data: object) -> list[PageAnalyticsReaderListType0Item] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                reader_list_type_0 = []
                _reader_list_type_0 = data
                for reader_list_type_0_item_data in (_reader_list_type_0):
                    reader_list_type_0_item = PageAnalyticsReaderListType0Item.from_dict(reader_list_type_0_item_data)



                    reader_list_type_0.append(reader_list_type_0_item)

                return reader_list_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[PageAnalyticsReaderListType0Item] | None, data)

        reader_list = _parse_reader_list(d.pop("readerList"))


        page_analytics = cls(
            days=days,
            views=views,
            readers=readers,
            daily=daily,
            reader_list=reader_list,
        )

        return page_analytics

