from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_mode import EmailMode
from ..models.notification_category import NotificationCategory
from typing import cast






T = TypeVar("T", bound="NotificationSettings")



@_attrs_define
class NotificationSettings:
    """ 
        Attributes:
            email_enabled (bool):
            email_categories (list[NotificationCategory]):
            email_mode (EmailMode):
            digest_hour (int):
            notify_own_changes (bool):
            email_available (bool):
     """

    email_enabled: bool
    email_categories: list[NotificationCategory]
    email_mode: EmailMode
    digest_hour: int
    notify_own_changes: bool
    email_available: bool





    def to_dict(self) -> dict[str, Any]:
        email_enabled = self.email_enabled

        email_categories = []
        for email_categories_item_data in self.email_categories:
            email_categories_item = email_categories_item_data.value
            email_categories.append(email_categories_item)



        email_mode = self.email_mode.value

        digest_hour = self.digest_hour

        notify_own_changes = self.notify_own_changes

        email_available = self.email_available


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "emailEnabled": email_enabled,
            "emailCategories": email_categories,
            "emailMode": email_mode,
            "digestHour": digest_hour,
            "notifyOwnChanges": notify_own_changes,
            "emailAvailable": email_available,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email_enabled = d.pop("emailEnabled")

        email_categories = []
        _email_categories = d.pop("emailCategories")
        for email_categories_item_data in (_email_categories):
            email_categories_item = NotificationCategory(email_categories_item_data)



            email_categories.append(email_categories_item)


        email_mode = EmailMode(d.pop("emailMode"))




        digest_hour = d.pop("digestHour")

        notify_own_changes = d.pop("notifyOwnChanges")

        email_available = d.pop("emailAvailable")

        notification_settings = cls(
            email_enabled=email_enabled,
            email_categories=email_categories,
            email_mode=email_mode,
            digest_hour=digest_hour,
            notify_own_changes=notify_own_changes,
            email_available=email_available,
        )

        return notification_settings

