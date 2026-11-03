from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="RetentionSettingsInput")



@_attrs_define
class RetentionSettingsInput:
    """ 
        Attributes:
            trash_days (int | Unset):  Default: 30.
            version_days (int | Unset):  Default: 0.
            audit_days (int | Unset):  Default: 365.
     """

    trash_days: int | Unset = 30
    version_days: int | Unset = 0
    audit_days: int | Unset = 365
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        trash_days = self.trash_days

        version_days = self.version_days

        audit_days = self.audit_days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if trash_days is not UNSET:
            field_dict["trashDays"] = trash_days
        if version_days is not UNSET:
            field_dict["versionDays"] = version_days
        if audit_days is not UNSET:
            field_dict["auditDays"] = audit_days

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        trash_days = d.pop("trashDays", UNSET)

        version_days = d.pop("versionDays", UNSET)

        audit_days = d.pop("auditDays", UNSET)

        retention_settings_input = cls(
            trash_days=trash_days,
            version_days=version_days,
            audit_days=audit_days,
        )


        retention_settings_input.additional_properties = d
        return retention_settings_input

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
