from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="RecoveryCodes")



@_attrs_define
class RecoveryCodes:
    """ 
        Attributes:
            codes (list[str]):
     """

    codes: list[str]





    def to_dict(self) -> dict[str, Any]:
        codes = self.codes




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "codes": codes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        codes = cast(list[str], d.pop("codes"))


        recovery_codes = cls(
            codes=codes,
        )

        return recovery_codes

