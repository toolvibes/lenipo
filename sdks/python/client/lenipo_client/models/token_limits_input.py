from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TokenLimitsInput")



@_attrs_define
class TokenLimitsInput:
    """ 
        Attributes:
            per_minute (int | None):
            per_day (int | None):
     """

    per_minute: int | None
    per_day: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        per_minute: int | None
        per_minute = self.per_minute

        per_day: int | None
        per_day = self.per_day


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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


        token_limits_input = cls(
            per_minute=per_minute,
            per_day=per_day,
        )


        token_limits_input.additional_properties = d
        return token_limits_input

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
