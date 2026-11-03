from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="SecurityGrantInputType1")



@_attrs_define
class SecurityGrantInputType1:
    """ 
        Attributes:
            group_id (UUID):
     """

    group_id: UUID





    def to_dict(self) -> dict[str, Any]:
        group_id = str(self.group_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "groupId": group_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        group_id = UUID(d.pop("groupId"))




        security_grant_input_type_1 = cls(
            group_id=group_id,
        )

        return security_grant_input_type_1

