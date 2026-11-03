from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.two_factor_status_pending_type_0 import TwoFactorStatusPendingType0
from typing import cast






T = TypeVar("T", bound="TwoFactorStatus")



@_attrs_define
class TwoFactorStatus:
    """ 
        Attributes:
            enabled (bool):
            required (bool):
            pending (None | TwoFactorStatusPendingType0):
            recovery_codes_left (int):
     """

    enabled: bool
    required: bool
    pending: None | TwoFactorStatusPendingType0
    recovery_codes_left: int





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        required = self.required

        pending: None | str
        if isinstance(self.pending, TwoFactorStatusPendingType0):
            pending = self.pending.value
        else:
            pending = self.pending

        recovery_codes_left = self.recovery_codes_left


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "required": required,
            "pending": pending,
            "recoveryCodesLeft": recovery_codes_left,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        required = d.pop("required")

        def _parse_pending(data: object) -> None | TwoFactorStatusPendingType0:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                pending_type_0 = TwoFactorStatusPendingType0(data)



                return pending_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TwoFactorStatusPendingType0, data)

        pending = _parse_pending(d.pop("pending"))


        recovery_codes_left = d.pop("recoveryCodesLeft")

        two_factor_status = cls(
            enabled=enabled,
            required=required,
            pending=pending,
            recovery_codes_left=recovery_codes_left,
        )

        return two_factor_status

