from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.permission_grant_input_type_3_grantee import PermissionGrantInputType3Grantee
from ..models.permission_grant_input_type_3_permission import PermissionGrantInputType3Permission






T = TypeVar("T", bound="PermissionGrantInputType3")



@_attrs_define
class PermissionGrantInputType3:
    """ 
        Attributes:
            permission (PermissionGrantInputType3Permission):
            grantee (PermissionGrantInputType3Grantee):
     """

    permission: PermissionGrantInputType3Permission
    grantee: PermissionGrantInputType3Grantee





    def to_dict(self) -> dict[str, Any]:
        permission = self.permission.value

        grantee = self.grantee.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "permission": permission,
            "grantee": grantee,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        permission = PermissionGrantInputType3Permission(d.pop("permission"))




        grantee = PermissionGrantInputType3Grantee(d.pop("grantee"))




        permission_grant_input_type_3 = cls(
            permission=permission,
            grantee=grantee,
        )

        return permission_grant_input_type_3

