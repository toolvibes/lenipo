from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast






T = TypeVar("T", bound="AppToken")



@_attrs_define
class AppToken:
    """ 
        Attributes:
            access_token (str):
            expires_in (int):
            scopes (list[TokenScope]):
     """

    access_token: str
    expires_in: int
    scopes: list[TokenScope]





    def to_dict(self) -> dict[str, Any]:
        access_token = self.access_token

        expires_in = self.expires_in

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "accessToken": access_token,
            "expiresIn": expires_in,
            "scopes": scopes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        access_token = d.pop("accessToken")

        expires_in = d.pop("expiresIn")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = TokenScope(scopes_item_data)



            scopes.append(scopes_item)


        app_token = cls(
            access_token=access_token,
            expires_in=expires_in,
            scopes=scopes,
        )

        return app_token

