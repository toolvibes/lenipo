from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="BackupSettingsInput")



@_attrs_define
class BackupSettingsInput:
    """ 
        Attributes:
            enabled (bool | Unset):  Default: True.
            hour (int | Unset):  Default: 2.
            keep (int | Unset):  Default: 3.
     """

    enabled: bool | Unset = True
    hour: int | Unset = 2
    keep: int | Unset = 3
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        hour = self.hour

        keep = self.keep


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if hour is not UNSET:
            field_dict["hour"] = hour
        if keep is not UNSET:
            field_dict["keep"] = keep

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled", UNSET)

        hour = d.pop("hour", UNSET)

        keep = d.pop("keep", UNSET)

        backup_settings_input = cls(
            enabled=enabled,
            hour=hour,
            keep=keep,
        )


        backup_settings_input.additional_properties = d
        return backup_settings_input

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
