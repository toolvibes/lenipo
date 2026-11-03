from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="UnreadCount")



@_attrs_define
class UnreadCount:
    """ 
        Attributes:
            count (int):
     """

    count: int





    def to_dict(self) -> dict[str, Any]:
        count = self.count


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "count": count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        count = d.pop("count")

        unread_count = cls(
            count=count,
        )

        return unread_count

