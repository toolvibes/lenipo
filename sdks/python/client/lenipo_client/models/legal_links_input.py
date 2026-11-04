from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="LegalLinksInput")



@_attrs_define
class LegalLinksInput:
    """ 
        Attributes:
            imprint_url (None | str | Unset):
            privacy_url (None | str | Unset):
     """

    imprint_url: None | str | Unset = UNSET
    privacy_url: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        imprint_url: None | str | Unset
        if isinstance(self.imprint_url, Unset):
            imprint_url = UNSET
        else:
            imprint_url = self.imprint_url

        privacy_url: None | str | Unset
        if isinstance(self.privacy_url, Unset):
            privacy_url = UNSET
        else:
            privacy_url = self.privacy_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if imprint_url is not UNSET:
            field_dict["imprintUrl"] = imprint_url
        if privacy_url is not UNSET:
            field_dict["privacyUrl"] = privacy_url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_imprint_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        imprint_url = _parse_imprint_url(d.pop("imprintUrl", UNSET))


        def _parse_privacy_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        privacy_url = _parse_privacy_url(d.pop("privacyUrl", UNSET))


        legal_links_input = cls(
            imprint_url=imprint_url,
            privacy_url=privacy_url,
        )


        legal_links_input.additional_properties = d
        return legal_links_input

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
