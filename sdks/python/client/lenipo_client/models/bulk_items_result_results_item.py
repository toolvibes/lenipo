from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="BulkItemsResultResultsItem")



@_attrs_define
class BulkItemsResultResultsItem:
    """ 
        Attributes:
            index (int):
            ok (bool):
            key (None | str):
            error (None | str):
     """

    index: int
    ok: bool
    key: None | str
    error: None | str





    def to_dict(self) -> dict[str, Any]:
        index = self.index

        ok = self.ok

        key: None | str
        key = self.key

        error: None | str
        error = self.error


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "index": index,
            "ok": ok,
            "key": key,
            "error": error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        index = d.pop("index")

        ok = d.pop("ok")

        def _parse_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key = _parse_key(d.pop("key"))


        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        bulk_items_result_results_item = cls(
            index=index,
            ok=ok,
            key=key,
            error=error,
        )

        return bulk_items_result_results_item

