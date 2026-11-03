from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole






T = TypeVar("T", bound="SecurityGrantInputType0")



@_attrs_define
class SecurityGrantInputType0:
    """ 
        Attributes:
            role (ProjectRole):
     """

    role: ProjectRole





    def to_dict(self) -> dict[str, Any]:
        role = self.role.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = ProjectRole(d.pop("role"))




        security_grant_input_type_0 = cls(
            role=role,
        )

        return security_grant_input_type_0

