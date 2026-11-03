from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OAuthConsentResult")



@_attrs_define
class OAuthConsentResult:
    """ 
        Attributes:
            redirect (str):
     """

    redirect: str





    def to_dict(self) -> dict[str, Any]:
        redirect = self.redirect


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "redirect": redirect,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        redirect = d.pop("redirect")

        o_auth_consent_result = cls(
            redirect=redirect,
        )

        return o_auth_consent_result

