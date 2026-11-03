from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TimePivotRowsItem")



@_attrs_define
class TimePivotRowsItem:
    """ 
        Attributes:
            key (None | str):
            label (str):
            values (list[int]):
            total (int):
     """

    key: None | str
    label: str
    values: list[int]
    total: int





    def to_dict(self) -> dict[str, Any]:
        key: None | str
        key = self.key

        label = self.label

        values = self.values



        total = self.total


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "label": label,
            "values": values,
            "total": total,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key = _parse_key(d.pop("key"))


        label = d.pop("label")

        values = cast(list[int], d.pop("values"))


        total = d.pop("total")

        time_pivot_rows_item = cls(
            key=key,
            label=label,
            values=values,
            total=total,
        )

        return time_pivot_rows_item

