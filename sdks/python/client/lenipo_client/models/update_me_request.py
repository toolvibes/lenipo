from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_me_request_locale import UpdateMeRequestLocale
from ..types import UNSET, Unset






T = TypeVar("T", bound="UpdateMeRequest")



@_attrs_define
class UpdateMeRequest:
    """ 
        Attributes:
            display_name (str | Unset):
            locale (UpdateMeRequestLocale | Unset):
            time_zone (str | Unset):
            keyboard_shortcuts (bool | Unset):
     """

    display_name: str | Unset = UNSET
    locale: UpdateMeRequestLocale | Unset = UNSET
    time_zone: str | Unset = UNSET
    keyboard_shortcuts: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        display_name = self.display_name

        locale: str | Unset = UNSET
        if not isinstance(self.locale, Unset):
            locale = self.locale.value


        time_zone = self.time_zone

        keyboard_shortcuts = self.keyboard_shortcuts


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if display_name is not UNSET:
            field_dict["displayName"] = display_name
        if locale is not UNSET:
            field_dict["locale"] = locale
        if time_zone is not UNSET:
            field_dict["timeZone"] = time_zone
        if keyboard_shortcuts is not UNSET:
            field_dict["keyboardShortcuts"] = keyboard_shortcuts

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        display_name = d.pop("displayName", UNSET)

        _locale = d.pop("locale", UNSET)
        locale: UpdateMeRequestLocale | Unset
        if isinstance(_locale,  Unset):
            locale = UNSET
        else:
            locale = UpdateMeRequestLocale(_locale)




        time_zone = d.pop("timeZone", UNSET)

        keyboard_shortcuts = d.pop("keyboardShortcuts", UNSET)

        update_me_request = cls(
            display_name=display_name,
            locale=locale,
            time_zone=time_zone,
            keyboard_shortcuts=keyboard_shortcuts,
        )


        update_me_request.additional_properties = d
        return update_me_request

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
