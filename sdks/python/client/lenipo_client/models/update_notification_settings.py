from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_mode import EmailMode
from ..models.notification_category import NotificationCategory
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="UpdateNotificationSettings")



@_attrs_define
class UpdateNotificationSettings:
    """ 
        Attributes:
            email_enabled (bool):
            email_categories (list[NotificationCategory]):
            email_mode (EmailMode | Unset):
            digest_hour (int | Unset):  Default: 8.
            notify_own_changes (bool | Unset):  Default: False.
     """

    email_enabled: bool
    email_categories: list[NotificationCategory]
    email_mode: EmailMode | Unset = UNSET
    digest_hour: int | Unset = 8
    notify_own_changes: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email_enabled = self.email_enabled

        email_categories = []
        for email_categories_item_data in self.email_categories:
            email_categories_item = email_categories_item_data.value
            email_categories.append(email_categories_item)



        email_mode: str | Unset = UNSET
        if not isinstance(self.email_mode, Unset):
            email_mode = self.email_mode.value


        digest_hour = self.digest_hour

        notify_own_changes = self.notify_own_changes


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "emailEnabled": email_enabled,
            "emailCategories": email_categories,
        })
        if email_mode is not UNSET:
            field_dict["emailMode"] = email_mode
        if digest_hour is not UNSET:
            field_dict["digestHour"] = digest_hour
        if notify_own_changes is not UNSET:
            field_dict["notifyOwnChanges"] = notify_own_changes

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


        _email_mode = d.pop("emailMode", UNSET)
        email_mode: EmailMode | Unset
        if isinstance(_email_mode,  Unset):
            email_mode = UNSET
        else:
            email_mode = EmailMode(_email_mode)




        digest_hour = d.pop("digestHour", UNSET)

        notify_own_changes = d.pop("notifyOwnChanges", UNSET)

        update_notification_settings = cls(
            email_enabled=email_enabled,
            email_categories=email_categories,
            email_mode=email_mode,
            digest_hour=digest_hour,
            notify_own_changes=notify_own_changes,
        )


        update_notification_settings.additional_properties = d
        return update_notification_settings

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
