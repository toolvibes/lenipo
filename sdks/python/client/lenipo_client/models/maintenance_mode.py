from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="MaintenanceMode")



@_attrs_define
class MaintenanceMode:
    """ 
        Attributes:
            enabled (bool):  Default: False.
            message (str):  Default: ''.
     """

    enabled: bool = False
    message: str = ''





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        message = d.pop("message")

        maintenance_mode = cls(
            enabled=enabled,
            message=message,
        )

        return maintenance_mode

