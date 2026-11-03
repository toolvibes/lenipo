from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TokenLimits")



@_attrs_define
class TokenLimits:
    """ 
        Attributes:
            per_minute (int | None):
            per_day (int | None):
     """

    per_minute: int | None
    per_day: int | None





    def to_dict(self) -> dict[str, Any]:
        per_minute: int | None
        per_minute = self.per_minute

        per_day: int | None
        per_day = self.per_day


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "perMinute": per_minute,
            "perDay": per_day,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_per_minute(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        per_minute = _parse_per_minute(d.pop("perMinute"))


        def _parse_per_day(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        per_day = _parse_per_day(d.pop("perDay"))


        token_limits = cls(
            per_minute=per_minute,
            per_day=per_day,
        )

        return token_limits

