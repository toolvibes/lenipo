from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="RegistrationSettings")



@_attrs_define
class RegistrationSettings:
    """ 
        Attributes:
            enabled (bool):
            domains (list[str]):
     """

    enabled: bool
    domains: list[str]





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        domains = self.domains




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "domains": domains,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        domains = cast(list[str], d.pop("domains"))


        registration_settings = cls(
            enabled=enabled,
            domains=domains,
        )

        return registration_settings

