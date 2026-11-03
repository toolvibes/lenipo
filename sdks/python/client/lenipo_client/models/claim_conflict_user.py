from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ClaimConflictUser")



@_attrs_define
class ClaimConflictUser:
    """ 
        Attributes:
            id (str):
            display_name (str):
     """

    id: str
    display_name: str





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        display_name = self.display_name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "displayName": display_name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        display_name = d.pop("displayName")

        claim_conflict_user = cls(
            id=id,
            display_name=display_name,
        )

        return claim_conflict_user

