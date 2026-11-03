from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="SaveOAuthAppRequest")



@_attrs_define
class SaveOAuthAppRequest:
    """ 
        Attributes:
            name (str):
            redirect_uris (list[str]):
            description (str | Unset):  Default: ''.
            confidential (bool | Unset):  Default: True.
     """

    name: str
    redirect_uris: list[str]
    description: str | Unset = ''
    confidential: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        redirect_uris = self.redirect_uris



        description = self.description

        confidential = self.confidential


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "redirectUris": redirect_uris,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if confidential is not UNSET:
            field_dict["confidential"] = confidential

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        redirect_uris = cast(list[str], d.pop("redirectUris"))


        description = d.pop("description", UNSET)

        confidential = d.pop("confidential", UNSET)

        save_o_auth_app_request = cls(
            name=name,
            redirect_uris=redirect_uris,
            description=description,
            confidential=confidential,
        )


        save_o_auth_app_request.additional_properties = d
        return save_o_auth_app_request

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
