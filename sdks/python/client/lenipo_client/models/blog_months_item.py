from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="BlogMonthsItem")



@_attrs_define
class BlogMonthsItem:
    """ 
        Attributes:
            month (str):
            count (int):
     """

    month: str
    count: int





    def to_dict(self) -> dict[str, Any]:
        month = self.month

        count = self.count


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "month": month,
            "count": count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        month = d.pop("month")

        count = d.pop("count")

        blog_months_item = cls(
            month=month,
            count=count,
        )

        return blog_months_item

