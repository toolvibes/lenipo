from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OAuthSettings")



@_attrs_define
class OAuthSettings:
    """ 
        Attributes:
            registration_open (bool):
     """

    registration_open: bool





    def to_dict(self) -> dict[str, Any]:
        registration_open = self.registration_open


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "registrationOpen": registration_open,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        registration_open = d.pop("registrationOpen")

        o_auth_settings = cls(
            registration_open=registration_open,
        )

        return o_auth_settings

