from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RateLimitSettings")



@_attrs_define
class RateLimitSettings:
    """ 
        Attributes:
            people (int):  Default: 600.
            tokens (int):  Default: 300.
            anonymous (int):  Default: 60.
     """

    people: int = 600
    tokens: int = 300
    anonymous: int = 60





    def to_dict(self) -> dict[str, Any]:
        people = self.people

        tokens = self.tokens

        anonymous = self.anonymous


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "people": people,
            "tokens": tokens,
            "anonymous": anonymous,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        people = d.pop("people")

        tokens = d.pop("tokens")

        anonymous = d.pop("anonymous")

        rate_limit_settings = cls(
            people=people,
            tokens=tokens,
            anonymous=anonymous,
        )

        return rate_limit_settings

