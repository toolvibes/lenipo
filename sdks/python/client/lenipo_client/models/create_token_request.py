from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast






T = TypeVar("T", bound="CreateTokenRequest")



@_attrs_define
class CreateTokenRequest:
    """ 
        Attributes:
            name (str):
            scopes (list[TokenScope]):
            expires_in_days (int):
     """

    name: str
    scopes: list[TokenScope]
    expires_in_days: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)



        expires_in_days = self.expires_in_days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "scopes": scopes,
            "expiresInDays": expires_in_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = TokenScope(scopes_item_data)



            scopes.append(scopes_item)


        expires_in_days = d.pop("expiresInDays")

        create_token_request = cls(
            name=name,
            scopes=scopes,
            expires_in_days=expires_in_days,
        )


        create_token_request.additional_properties = d
        return create_token_request

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
