from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SetupStatusResponse")



@_attrs_define
class SetupStatusResponse:
    """ 
        Attributes:
            required (bool):
     """

    required: bool





    def to_dict(self) -> dict[str, Any]:
        required = self.required


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "required": required,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        required = d.pop("required")

        setup_status_response = cls(
            required=required,
        )

        return setup_status_response

