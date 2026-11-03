from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="BulkResultResultsItem")



@_attrs_define
class BulkResultResultsItem:
    """ 
        Attributes:
            key (str):
            ok (bool):
            error (None | str):
     """

    key: str
    ok: bool
    error: None | str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        ok = self.ok

        error: None | str
        error = self.error


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "ok": ok,
            "error": error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        ok = d.pop("ok")

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        bulk_result_results_item = cls(
            key=key,
            ok=ok,
            error=error,
        )

        return bulk_result_results_item

