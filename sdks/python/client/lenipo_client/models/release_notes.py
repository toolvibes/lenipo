from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ReleaseNotes")



@_attrs_define
class ReleaseNotes:
    """ 
        Attributes:
            title (str):
            markdown (str):
     """

    title: str
    markdown: str





    def to_dict(self) -> dict[str, Any]:
        title = self.title

        markdown = self.markdown


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "title": title,
            "markdown": markdown,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title")

        markdown = d.pop("markdown")

        release_notes = cls(
            title=title,
            markdown=markdown,
        )

        return release_notes

