from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="UserLookup")



@_attrs_define
class UserLookup:
    """ 
        Attributes:
            id (UUID):
            display_name (str):
            email (str):
     """

    id: UUID
    display_name: str
    email: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        display_name = self.display_name

        email = self.email


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "displayName": display_name,
            "email": email,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        display_name = d.pop("displayName")

        email = d.pop("email")

        user_lookup = cls(
            id=id,
            display_name=display_name,
            email=email,
        )

        return user_lookup

