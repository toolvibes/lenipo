from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DirectoriesTestResponse201")



@_attrs_define
class DirectoriesTestResponse201:
    """ 
        Attributes:
            ok (bool):
            message (str):
     """

    ok: bool
    message: str





    def to_dict(self) -> dict[str, Any]:
        ok = self.ok

        message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "ok": ok,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ok = d.pop("ok")

        message = d.pop("message")

        directories_test_response_201 = cls(
            ok=ok,
            message=message,
        )

        return directories_test_response_201

