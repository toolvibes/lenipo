from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="RateLimitSettingsInput")



@_attrs_define
class RateLimitSettingsInput:
    """ 
        Attributes:
            people (int | Unset):  Default: 600.
            tokens (int | Unset):  Default: 300.
            anonymous (int | Unset):  Default: 60.
     """

    people: int | Unset = 600
    tokens: int | Unset = 300
    anonymous: int | Unset = 60
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        people = self.people

        tokens = self.tokens

        anonymous = self.anonymous


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if people is not UNSET:
            field_dict["people"] = people
        if tokens is not UNSET:
            field_dict["tokens"] = tokens
        if anonymous is not UNSET:
            field_dict["anonymous"] = anonymous

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        people = d.pop("people", UNSET)

        tokens = d.pop("tokens", UNSET)

        anonymous = d.pop("anonymous", UNSET)

        rate_limit_settings_input = cls(
            people=people,
            tokens=tokens,
            anonymous=anonymous,
        )


        rate_limit_settings_input.additional_properties = d
        return rate_limit_settings_input

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
