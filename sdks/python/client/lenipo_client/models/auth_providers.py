from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.auth_providers_oidc import AuthProvidersOidc
  from ..models.auth_providers_saml_item import AuthProvidersSamlItem





T = TypeVar("T", bound="AuthProviders")



@_attrs_define
class AuthProviders:
    """ 
        Attributes:
            password (bool):
            oidc (AuthProvidersOidc):
            saml (list[AuthProvidersSamlItem]):
     """

    password: bool
    oidc: AuthProvidersOidc
    saml: list[AuthProvidersSamlItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.auth_providers_oidc import AuthProvidersOidc # noqa: PLC0415
        from ..models.auth_providers_saml_item import AuthProvidersSamlItem # noqa: PLC0415
        password = self.password

        oidc = self.oidc.to_dict()

        saml = []
        for saml_item_data in self.saml:
            saml_item = saml_item_data.to_dict()
            saml.append(saml_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "password": password,
            "oidc": oidc,
            "saml": saml,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.auth_providers_oidc import AuthProvidersOidc # noqa: PLC0415
        from ..models.auth_providers_saml_item import AuthProvidersSamlItem # noqa: PLC0415
        d = dict(src_dict)
        password = d.pop("password")

        oidc = AuthProvidersOidc.from_dict(d.pop("oidc"))




        saml = []
        _saml = d.pop("saml")
        for saml_item_data in (_saml):
            saml_item = AuthProvidersSamlItem.from_dict(saml_item_data)



            saml.append(saml_item)


        auth_providers = cls(
            password=password,
            oidc=oidc,
            saml=saml,
        )

        return auth_providers

