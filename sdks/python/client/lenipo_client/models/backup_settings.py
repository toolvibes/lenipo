from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="BackupSettings")



@_attrs_define
class BackupSettings:
    """ 
        Attributes:
            enabled (bool):  Default: True.
            hour (int):  Default: 2.
            keep (int):  Default: 3.
     """

    enabled: bool = True
    hour: int = 2
    keep: int = 3





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        hour = self.hour

        keep = self.keep


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "hour": hour,
            "keep": keep,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        hour = d.pop("hour")

        keep = d.pop("keep")

        backup_settings = cls(
            enabled=enabled,
            hour=hour,
            keep=keep,
        )

        return backup_settings

