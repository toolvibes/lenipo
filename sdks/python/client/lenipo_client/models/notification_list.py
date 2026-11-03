from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.notification import Notification





T = TypeVar("T", bound="NotificationList")



@_attrs_define
class NotificationList:
    """ 
        Attributes:
            notifications (list[Notification]):
            unread_count (int):
     """

    notifications: list[Notification]
    unread_count: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.notification import Notification # noqa: PLC0415
        notifications = []
        for notifications_item_data in self.notifications:
            notifications_item = notifications_item_data.to_dict()
            notifications.append(notifications_item)



        unread_count = self.unread_count


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "notifications": notifications,
            "unreadCount": unread_count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification import Notification # noqa: PLC0415
        d = dict(src_dict)
        notifications = []
        _notifications = d.pop("notifications")
        for notifications_item_data in (_notifications):
            notifications_item = Notification.from_dict(notifications_item_data)



            notifications.append(notifications_item)


        unread_count = d.pop("unreadCount")

        notification_list = cls(
            notifications=notifications,
            unread_count=unread_count,
        )

        return notification_list

