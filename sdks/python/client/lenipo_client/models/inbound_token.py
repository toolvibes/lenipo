from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InboundToken")



@_attrs_define
class InboundToken:
    """ 
        Attributes:
            secret (str):
            path (str):
     """

    secret: str
    path: str





    def to_dict(self) -> dict[str, Any]:
        secret = self.secret

        path = self.path


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "secret": secret,
            "path": path,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        secret = d.pop("secret")

        path = d.pop("path")

        inbound_token = cls(
            secret=secret,
            path=path,
        )

        return inbound_token

