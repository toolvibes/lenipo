from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AiSettingsIndexed")



@_attrs_define
class AiSettingsIndexed:
    """ 
        Attributes:
            issues (int):
            pages (int):
     """

    issues: int
    pages: int





    def to_dict(self) -> dict[str, Any]:
        issues = self.issues

        pages = self.pages


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "pages": pages,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issues = d.pop("issues")

        pages = d.pop("pages")

        ai_settings_indexed = cls(
            issues=issues,
            pages=pages,
        )

        return ai_settings_indexed

