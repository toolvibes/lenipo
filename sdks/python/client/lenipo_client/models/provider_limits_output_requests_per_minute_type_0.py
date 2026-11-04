from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ProviderLimitsOutputRequestsPerMinuteType0")



@_attrs_define
class ProviderLimitsOutputRequestsPerMinuteType0:
    """ 
        Attributes:
            people (int):
            tokens (int):
            anonymous (int):
     """

    people: int
    tokens: int
    anonymous: int





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

        provider_limits_output_requests_per_minute_type_0 = cls(
            people=people,
            tokens=tokens,
            anonymous=anonymous,
        )

        return provider_limits_output_requests_per_minute_type_0

