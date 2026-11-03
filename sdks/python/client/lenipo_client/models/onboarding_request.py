from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.onboarding_request_start import OnboardingRequestStart
  from ..models.update_me_request import UpdateMeRequest





T = TypeVar("T", bound="OnboardingRequest")



@_attrs_define
class OnboardingRequest:
    """ 
        Attributes:
            profile (UpdateMeRequest | Unset):
            start (OnboardingRequestStart | Unset):
     """

    profile: UpdateMeRequest | Unset = UNSET
    start: OnboardingRequestStart | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.onboarding_request_start import OnboardingRequestStart # noqa: PLC0415
        from ..models.update_me_request import UpdateMeRequest # noqa: PLC0415
        profile: dict[str, Any] | Unset = UNSET
        if not isinstance(self.profile, Unset):
            profile = self.profile.to_dict()

        start: dict[str, Any] | Unset = UNSET
        if not isinstance(self.start, Unset):
            start = self.start.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if profile is not UNSET:
            field_dict["profile"] = profile
        if start is not UNSET:
            field_dict["start"] = start

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.onboarding_request_start import OnboardingRequestStart # noqa: PLC0415
        from ..models.update_me_request import UpdateMeRequest # noqa: PLC0415
        d = dict(src_dict)
        _profile = d.pop("profile", UNSET)
        profile: UpdateMeRequest | Unset
        if isinstance(_profile,  Unset):
            profile = UNSET
        else:
            profile = UpdateMeRequest.from_dict(_profile)




        _start = d.pop("start", UNSET)
        start: OnboardingRequestStart | Unset
        if isinstance(_start,  Unset):
            start = UNSET
        else:
            start = OnboardingRequestStart.from_dict(_start)




        onboarding_request = cls(
            profile=profile,
            start=start,
        )


        onboarding_request.additional_properties = d
        return onboarding_request

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
