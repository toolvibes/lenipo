from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="LegalLinks")



@_attrs_define
class LegalLinks:
    """ 
        Attributes:
            imprint_url (None | str):
            privacy_url (None | str):
     """

    imprint_url: None | str
    privacy_url: None | str





    def to_dict(self) -> dict[str, Any]:
        imprint_url: None | str
        imprint_url = self.imprint_url

        privacy_url: None | str
        privacy_url = self.privacy_url


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "imprintUrl": imprint_url,
            "privacyUrl": privacy_url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_imprint_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        imprint_url = _parse_imprint_url(d.pop("imprintUrl"))


        def _parse_privacy_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        privacy_url = _parse_privacy_url(d.pop("privacyUrl"))


        legal_links = cls(
            imprint_url=imprint_url,
            privacy_url=privacy_url,
        )

        return legal_links

