from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.security_grant_input_type_3_grantee import SecurityGrantInputType3Grantee






T = TypeVar("T", bound="SecurityGrantInputType3")



@_attrs_define
class SecurityGrantInputType3:
    """ 
        Attributes:
            grantee (SecurityGrantInputType3Grantee):
     """

    grantee: SecurityGrantInputType3Grantee





    def to_dict(self) -> dict[str, Any]:
        grantee = self.grantee.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "grantee": grantee,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        grantee = SecurityGrantInputType3Grantee(d.pop("grantee"))




        security_grant_input_type_3 = cls(
            grantee=grantee,
        )

        return security_grant_input_type_3

