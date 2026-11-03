from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AppModule")



@_attrs_define
class AppModule:
    """ 
        Attributes:
            key (str):
            title (str):
            url (str):
     """

    key: str
    title: str
    url: str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        title = self.title

        url = self.url


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "title": title,
            "url": url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        title = d.pop("title")

        url = d.pop("url")

        app_module = cls(
            key=key,
            title=title,
            url=url,
        )

        return app_module

