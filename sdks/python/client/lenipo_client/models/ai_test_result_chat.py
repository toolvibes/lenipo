from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AiTestResultChat")



@_attrs_define
class AiTestResultChat:
    """ 
        Attributes:
            ok (bool):
            detail (str):
     """

    ok: bool
    detail: str





    def to_dict(self) -> dict[str, Any]:
        ok = self.ok

        detail = self.detail


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "ok": ok,
            "detail": detail,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ok = d.pop("ok")

        detail = d.pop("detail")

        ai_test_result_chat = cls(
            ok=ok,
            detail=detail,
        )

        return ai_test_result_chat

