from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from ..types import UNSET, Unset
from typing import cast
from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="OAuthConsentRequest")



@_attrs_define
class OAuthConsentRequest:
    """ 
        Attributes:
            client_id (UUID):
            redirect_uri (str):
            scopes (list[TokenScope]):
            approve (bool):
            code_challenge (str):
            code_challenge_method (Literal['S256']):
            state (str | Unset):
            resource (str | Unset):
     """

    client_id: UUID
    redirect_uri: str
    scopes: list[TokenScope]
    approve: bool
    code_challenge: str
    code_challenge_method: Literal['S256']
    state: str | Unset = UNSET
    resource: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        client_id = str(self.client_id)

        redirect_uri = self.redirect_uri

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)



        approve = self.approve

        code_challenge = self.code_challenge

        code_challenge_method = self.code_challenge_method

        state = self.state

        resource = self.resource


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "clientId": client_id,
            "redirectUri": redirect_uri,
            "scopes": scopes,
            "approve": approve,
            "codeChallenge": code_challenge,
            "codeChallengeMethod": code_challenge_method,
        })
        if state is not UNSET:
            field_dict["state"] = state
        if resource is not UNSET:
            field_dict["resource"] = resource

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        client_id = UUID(d.pop("clientId"))




        redirect_uri = d.pop("redirectUri")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = TokenScope(scopes_item_data)



            scopes.append(scopes_item)


        approve = d.pop("approve")

        code_challenge = d.pop("codeChallenge")

        code_challenge_method = cast(Literal['S256'] , d.pop("codeChallengeMethod"))
        if code_challenge_method != 'S256':
            raise ValueError(f"codeChallengeMethod must match const 'S256', got '{code_challenge_method}'")

        state = d.pop("state", UNSET)

        resource = d.pop("resource", UNSET)

        o_auth_consent_request = cls(
            client_id=client_id,
            redirect_uri=redirect_uri,
            scopes=scopes,
            approve=approve,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            state=state,
            resource=resource,
        )


        o_auth_consent_request.additional_properties = d
        return o_auth_consent_request

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
