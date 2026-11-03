from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DirectoryConfigType0")



@_attrs_define
class DirectoryConfigType0:
    """ 
        Attributes:
            url (str):
            start_tls (bool):  Default: False.
            bind_dn (str):
            user_base (str):
            user_filter (str):  Default: '(objectClass=person)'.
            login_attribute (str):  Default: 'uid'.
            email_attribute (str):  Default: 'mail'.
            name_attribute (str):  Default: 'cn'.
            group_base (str):  Default: ''.
            group_filter (str):  Default: '(objectClass=groupOfNames)'.
            group_name_attribute (str):  Default: 'cn'.
            group_member_attribute (str):  Default: 'member'.
            has_password (bool):
     """

    url: str
    bind_dn: str
    user_base: str
    has_password: bool
    start_tls: bool = False
    user_filter: str = '(objectClass=person)'
    login_attribute: str = 'uid'
    email_attribute: str = 'mail'
    name_attribute: str = 'cn'
    group_base: str = ''
    group_filter: str = '(objectClass=groupOfNames)'
    group_name_attribute: str = 'cn'
    group_member_attribute: str = 'member'





    def to_dict(self) -> dict[str, Any]:
        url = self.url

        start_tls = self.start_tls

        bind_dn = self.bind_dn

        user_base = self.user_base

        user_filter = self.user_filter

        login_attribute = self.login_attribute

        email_attribute = self.email_attribute

        name_attribute = self.name_attribute

        group_base = self.group_base

        group_filter = self.group_filter

        group_name_attribute = self.group_name_attribute

        group_member_attribute = self.group_member_attribute

        has_password = self.has_password


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "url": url,
            "startTls": start_tls,
            "bindDn": bind_dn,
            "userBase": user_base,
            "userFilter": user_filter,
            "loginAttribute": login_attribute,
            "emailAttribute": email_attribute,
            "nameAttribute": name_attribute,
            "groupBase": group_base,
            "groupFilter": group_filter,
            "groupNameAttribute": group_name_attribute,
            "groupMemberAttribute": group_member_attribute,
            "hasPassword": has_password,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        start_tls = d.pop("startTls")

        bind_dn = d.pop("bindDn")

        user_base = d.pop("userBase")

        user_filter = d.pop("userFilter")

        login_attribute = d.pop("loginAttribute")

        email_attribute = d.pop("emailAttribute")

        name_attribute = d.pop("nameAttribute")

        group_base = d.pop("groupBase")

        group_filter = d.pop("groupFilter")

        group_name_attribute = d.pop("groupNameAttribute")

        group_member_attribute = d.pop("groupMemberAttribute")

        has_password = d.pop("hasPassword")

        directory_config_type_0 = cls(
            url=url,
            start_tls=start_tls,
            bind_dn=bind_dn,
            user_base=user_base,
            user_filter=user_filter,
            login_attribute=login_attribute,
            email_attribute=email_attribute,
            name_attribute=name_attribute,
            group_base=group_base,
            group_filter=group_filter,
            group_name_attribute=group_name_attribute,
            group_member_attribute=group_member_attribute,
            has_password=has_password,
        )

        return directory_config_type_0

