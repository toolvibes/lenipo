from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="StatisticValue")



@_attrs_define
class StatisticValue:
    """ 
        Attributes:
            key (None | str):
            label (str):
            color (None | str):
     """

    key: None | str
    label: str
    color: None | str





    def to_dict(self) -> dict[str, Any]:
        key: None | str
        key = self.key

        label = self.label

        color: None | str
        color = self.color


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "label": label,
            "color": color,
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

        def _parse_color(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        color = _parse_color(d.pop("color"))


        statistic_value = cls(
            key=key,
            label=label,
            color=color,
        )

        return statistic_value

