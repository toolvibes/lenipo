from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="CreateUserRequest")



@_attrs_define
class CreateUserRequest:
    """ 
        Attributes:
            email (str):
            display_name (str):
            password (str):
            groups (list[str] | Unset):
            external (bool | Unset):  Default: False.
     """

    email: str
    display_name: str
    password: str
    groups: list[str] | Unset = UNSET
    external: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email = self.email

        display_name = self.display_name

        password = self.password

        groups: list[str] | Unset = UNSET
        if not isinstance(self.groups, Unset):
            groups = self.groups



        external = self.external


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email": email,
            "displayName": display_name,
            "password": password,
        })
        if groups is not UNSET:
            field_dict["groups"] = groups
        if external is not UNSET:
            field_dict["external"] = external

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email")

        display_name = d.pop("displayName")

        password = d.pop("password")

        groups = cast(list[str], d.pop("groups", UNSET))


        external = d.pop("external", UNSET)

        create_user_request = cls(
            email=email,
            display_name=display_name,
            password=password,
            groups=groups,
            external=external,
        )


        create_user_request.additional_properties = d
        return create_user_request

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
