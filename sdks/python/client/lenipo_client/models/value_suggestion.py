from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="ValueSuggestion")



@_attrs_define
class ValueSuggestion:
    """ 
        Attributes:
            value (str):
            label (str):
            detail (str | Unset):
            key (str | Unset):
     """

    value: str
    label: str
    detail: str | Unset = UNSET
    key: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        value = self.value

        label = self.label

        detail = self.detail

        key = self.key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "value": value,
            "label": label,
        })
        if detail is not UNSET:
            field_dict["detail"] = detail
        if key is not UNSET:
            field_dict["key"] = key

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        value = d.pop("value")

        label = d.pop("label")

        detail = d.pop("detail", UNSET)

        key = d.pop("key", UNSET)

        value_suggestion = cls(
            value=value,
            label=label,
            detail=detail,
            key=key,
        )

        return value_suggestion

