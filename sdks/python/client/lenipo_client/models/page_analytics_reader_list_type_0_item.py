from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PageAnalyticsReaderListType0Item")



@_attrs_define
class PageAnalyticsReaderListType0Item:
    """ 
        Attributes:
            user (UserRef):
            views (int):
            last_viewed (datetime.date):
     """

    user: UserRef
    views: int
    last_viewed: datetime.date





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        user = self.user.to_dict()

        views = self.views

        last_viewed = self.last_viewed.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user": user,
            "views": views,
            "lastViewed": last_viewed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        user = UserRef.from_dict(d.pop("user"))




        views = d.pop("views")

        last_viewed = datetime.date.fromisoformat(d.pop("lastViewed"))




        page_analytics_reader_list_type_0_item = cls(
            user=user,
            views=views,
            last_viewed=last_viewed,
        )

        return page_analytics_reader_list_type_0_item

