from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="AuthProvidersOidc")



@_attrs_define
class AuthProvidersOidc:
    """ 
        Attributes:
            enabled (bool):
            display_name (None | str):
     """

    enabled: bool
    display_name: None | str





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        display_name: None | str
        display_name = self.display_name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "displayName": display_name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        def _parse_display_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        display_name = _parse_display_name(d.pop("displayName"))


        auth_providers_oidc = cls(
            enabled=enabled,
            display_name=display_name,
        )

        return auth_providers_oidc

