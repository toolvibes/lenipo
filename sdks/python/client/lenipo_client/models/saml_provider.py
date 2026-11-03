from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="SamlProvider")



@_attrs_define
class SamlProvider:
    """ 
        Attributes:
            id (UUID):
            name (str):
            enabled (bool):
            idp_entity_id (str):
            sso_url (str):
            certificates (int):
            email_attribute (str):
            name_attribute (str):
            groups_attribute (str):
            create_users (bool):
            sp_entity_id (str):
            acs_url (str):
            metadata_url (str):
     """

    id: UUID
    name: str
    enabled: bool
    idp_entity_id: str
    sso_url: str
    certificates: int
    email_attribute: str
    name_attribute: str
    groups_attribute: str
    create_users: bool
    sp_entity_id: str
    acs_url: str
    metadata_url: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        enabled = self.enabled

        idp_entity_id = self.idp_entity_id

        sso_url = self.sso_url

        certificates = self.certificates

        email_attribute = self.email_attribute

        name_attribute = self.name_attribute

        groups_attribute = self.groups_attribute

        create_users = self.create_users

        sp_entity_id = self.sp_entity_id

        acs_url = self.acs_url

        metadata_url = self.metadata_url


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "enabled": enabled,
            "idpEntityId": idp_entity_id,
            "ssoUrl": sso_url,
            "certificates": certificates,
            "emailAttribute": email_attribute,
            "nameAttribute": name_attribute,
            "groupsAttribute": groups_attribute,
            "createUsers": create_users,
            "spEntityId": sp_entity_id,
            "acsUrl": acs_url,
            "metadataUrl": metadata_url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        enabled = d.pop("enabled")

        idp_entity_id = d.pop("idpEntityId")

        sso_url = d.pop("ssoUrl")

        certificates = d.pop("certificates")

        email_attribute = d.pop("emailAttribute")

        name_attribute = d.pop("nameAttribute")

        groups_attribute = d.pop("groupsAttribute")

        create_users = d.pop("createUsers")

        sp_entity_id = d.pop("spEntityId")

        acs_url = d.pop("acsUrl")

        metadata_url = d.pop("metadataUrl")

        saml_provider = cls(
            id=id,
            name=name,
            enabled=enabled,
            idp_entity_id=idp_entity_id,
            sso_url=sso_url,
            certificates=certificates,
            email_attribute=email_attribute,
            name_attribute=name_attribute,
            groups_attribute=groups_attribute,
            create_users=create_users,
            sp_entity_id=sp_entity_id,
            acs_url=acs_url,
            metadata_url=metadata_url,
        )

        return saml_provider

