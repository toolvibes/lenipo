from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="SaveSamlProviderRequest")



@_attrs_define
class SaveSamlProviderRequest:
    """ 
        Attributes:
            name (str):
            enabled (bool | Unset):  Default: True.
            metadata (str | Unset):  Default: ''.
            email_attribute (str | Unset):  Default: 'email'.
            name_attribute (str | Unset):  Default: 'displayName'.
            groups_attribute (str | Unset):  Default: ''.
            create_users (bool | Unset):  Default: True.
     """

    name: str
    enabled: bool | Unset = True
    metadata: str | Unset = ''
    email_attribute: str | Unset = 'email'
    name_attribute: str | Unset = 'displayName'
    groups_attribute: str | Unset = ''
    create_users: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        enabled = self.enabled

        metadata = self.metadata

        email_attribute = self.email_attribute

        name_attribute = self.name_attribute

        groups_attribute = self.groups_attribute

        create_users = self.create_users


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if email_attribute is not UNSET:
            field_dict["emailAttribute"] = email_attribute
        if name_attribute is not UNSET:
            field_dict["nameAttribute"] = name_attribute
        if groups_attribute is not UNSET:
            field_dict["groupsAttribute"] = groups_attribute
        if create_users is not UNSET:
            field_dict["createUsers"] = create_users

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        enabled = d.pop("enabled", UNSET)

        metadata = d.pop("metadata", UNSET)

        email_attribute = d.pop("emailAttribute", UNSET)

        name_attribute = d.pop("nameAttribute", UNSET)

        groups_attribute = d.pop("groupsAttribute", UNSET)

        create_users = d.pop("createUsers", UNSET)

        save_saml_provider_request = cls(
            name=name,
            enabled=enabled,
            metadata=metadata,
            email_attribute=email_attribute,
            name_attribute=name_attribute,
            groups_attribute=groups_attribute,
            create_users=create_users,
        )


        save_saml_provider_request.additional_properties = d
        return save_saml_provider_request

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
