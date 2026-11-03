from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RetentionSettings")



@_attrs_define
class RetentionSettings:
    """ 
        Attributes:
            trash_days (int):  Default: 30.
            version_days (int):  Default: 0.
            audit_days (int):  Default: 365.
     """

    trash_days: int = 30
    version_days: int = 0
    audit_days: int = 365





    def to_dict(self) -> dict[str, Any]:
        trash_days = self.trash_days

        version_days = self.version_days

        audit_days = self.audit_days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "trashDays": trash_days,
            "versionDays": version_days,
            "auditDays": audit_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        trash_days = d.pop("trashDays")

        version_days = d.pop("versionDays")

        audit_days = d.pop("auditDays")

        retention_settings = cls(
            trash_days=trash_days,
            version_days=version_days,
            audit_days=audit_days,
        )

        return retention_settings

