from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="LdapConfig")



@_attrs_define
class LdapConfig:
    """ 
        Attributes:
            url (str):
            bind_dn (str):
            user_base (str):
            start_tls (bool | Unset):  Default: False.
            bind_password (str | Unset):  Default: ''.
            user_filter (str | Unset):  Default: '(objectClass=person)'.
            login_attribute (str | Unset):  Default: 'uid'.
            email_attribute (str | Unset):  Default: 'mail'.
            name_attribute (str | Unset):  Default: 'cn'.
            group_base (str | Unset):  Default: ''.
            group_filter (str | Unset):  Default: '(objectClass=groupOfNames)'.
            group_name_attribute (str | Unset):  Default: 'cn'.
            group_member_attribute (str | Unset):  Default: 'member'.
     """

    url: str
    bind_dn: str
    user_base: str
    start_tls: bool | Unset = False
    bind_password: str | Unset = ''
    user_filter: str | Unset = '(objectClass=person)'
    login_attribute: str | Unset = 'uid'
    email_attribute: str | Unset = 'mail'
    name_attribute: str | Unset = 'cn'
    group_base: str | Unset = ''
    group_filter: str | Unset = '(objectClass=groupOfNames)'
    group_name_attribute: str | Unset = 'cn'
    group_member_attribute: str | Unset = 'member'
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        url = self.url

        bind_dn = self.bind_dn

        user_base = self.user_base

        start_tls = self.start_tls

        bind_password = self.bind_password

        user_filter = self.user_filter

        login_attribute = self.login_attribute

        email_attribute = self.email_attribute

        name_attribute = self.name_attribute

        group_base = self.group_base

        group_filter = self.group_filter

        group_name_attribute = self.group_name_attribute

        group_member_attribute = self.group_member_attribute


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "url": url,
            "bindDn": bind_dn,
            "userBase": user_base,
        })
        if start_tls is not UNSET:
            field_dict["startTls"] = start_tls
        if bind_password is not UNSET:
            field_dict["bindPassword"] = bind_password
        if user_filter is not UNSET:
            field_dict["userFilter"] = user_filter
        if login_attribute is not UNSET:
            field_dict["loginAttribute"] = login_attribute
        if email_attribute is not UNSET:
            field_dict["emailAttribute"] = email_attribute
        if name_attribute is not UNSET:
            field_dict["nameAttribute"] = name_attribute
        if group_base is not UNSET:
            field_dict["groupBase"] = group_base
        if group_filter is not UNSET:
            field_dict["groupFilter"] = group_filter
        if group_name_attribute is not UNSET:
            field_dict["groupNameAttribute"] = group_name_attribute
        if group_member_attribute is not UNSET:
            field_dict["groupMemberAttribute"] = group_member_attribute

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        bind_dn = d.pop("bindDn")

        user_base = d.pop("userBase")

        start_tls = d.pop("startTls", UNSET)

        bind_password = d.pop("bindPassword", UNSET)

        user_filter = d.pop("userFilter", UNSET)

        login_attribute = d.pop("loginAttribute", UNSET)

        email_attribute = d.pop("emailAttribute", UNSET)

        name_attribute = d.pop("nameAttribute", UNSET)

        group_base = d.pop("groupBase", UNSET)

        group_filter = d.pop("groupFilter", UNSET)

        group_name_attribute = d.pop("groupNameAttribute", UNSET)

        group_member_attribute = d.pop("groupMemberAttribute", UNSET)

        ldap_config = cls(
            url=url,
            bind_dn=bind_dn,
            user_base=user_base,
            start_tls=start_tls,
            bind_password=bind_password,
            user_filter=user_filter,
            login_attribute=login_attribute,
            email_attribute=email_attribute,
            name_attribute=name_attribute,
            group_base=group_base,
            group_filter=group_filter,
            group_name_attribute=group_name_attribute,
            group_member_attribute=group_member_attribute,
        )


        ldap_config.additional_properties = d
        return ldap_config

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
