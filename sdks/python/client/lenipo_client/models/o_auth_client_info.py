from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="OAuthClientInfo")



@_attrs_define
class OAuthClientInfo:
    """ 
        Attributes:
            id (UUID):
            name (str):
            redirect_host (str):
            requested_scopes (list[TokenScope]):
            registered (bool):
            description (str):
     """

    id: UUID
    name: str
    redirect_host: str
    requested_scopes: list[TokenScope]
    registered: bool
    description: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        redirect_host = self.redirect_host

        requested_scopes = []
        for requested_scopes_item_data in self.requested_scopes:
            requested_scopes_item = requested_scopes_item_data.value
            requested_scopes.append(requested_scopes_item)



        registered = self.registered

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "redirectHost": redirect_host,
            "requestedScopes": requested_scopes,
            "registered": registered,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        redirect_host = d.pop("redirectHost")

        requested_scopes = []
        _requested_scopes = d.pop("requestedScopes")
        for requested_scopes_item_data in (_requested_scopes):
            requested_scopes_item = TokenScope(requested_scopes_item_data)



            requested_scopes.append(requested_scopes_item)


        registered = d.pop("registered")

        description = d.pop("description")

        o_auth_client_info = cls(
            id=id,
            name=name,
            redirect_host=redirect_host,
            requested_scopes=requested_scopes,
            registered=registered,
            description=description,
        )

        return o_auth_client_info

