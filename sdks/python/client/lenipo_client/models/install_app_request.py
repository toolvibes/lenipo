from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast






T = TypeVar("T", bound="InstallAppRequest")



@_attrs_define
class InstallAppRequest:
    """ 
        Attributes:
            manifest_url (str):
            approved_scopes (list[TokenScope]):
     """

    manifest_url: str
    approved_scopes: list[TokenScope]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        manifest_url = self.manifest_url

        approved_scopes = []
        for approved_scopes_item_data in self.approved_scopes:
            approved_scopes_item = approved_scopes_item_data.value
            approved_scopes.append(approved_scopes_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "manifestUrl": manifest_url,
            "approvedScopes": approved_scopes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        manifest_url = d.pop("manifestUrl")

        approved_scopes = []
        _approved_scopes = d.pop("approvedScopes")
        for approved_scopes_item_data in (_approved_scopes):
            approved_scopes_item = TokenScope(approved_scopes_item_data)



            approved_scopes.append(approved_scopes_item)


        install_app_request = cls(
            manifest_url=manifest_url,
            approved_scopes=approved_scopes,
        )


        install_app_request.additional_properties = d
        return install_app_request

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
