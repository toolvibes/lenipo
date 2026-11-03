from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.onboarding_request_start_method import OnboardingRequestStartMethod






T = TypeVar("T", bound="OnboardingRequestStart")



@_attrs_define
class OnboardingRequestStart:
    """ 
        Attributes:
            method (OnboardingRequestStartMethod):
            name (str):
            key (str):
     """

    method: OnboardingRequestStartMethod
    name: str
    key: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        method = self.method.value

        name = self.name

        key = self.key


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "method": method,
            "name": name,
            "key": key,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        method = OnboardingRequestStartMethod(d.pop("method"))




        name = d.pop("name")

        key = d.pop("key")

        onboarding_request_start = cls(
            method=method,
            name=name,
            key=key,
        )


        onboarding_request_start.additional_properties = d
        return onboarding_request_start

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
