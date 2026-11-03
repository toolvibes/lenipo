from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RestoreResult")



@_attrs_define
class RestoreResult:
    """ 
        Attributes:
            tables (int):
            rows (int):
            files (int):
     """

    tables: int
    rows: int
    files: int





    def to_dict(self) -> dict[str, Any]:
        tables = self.tables

        rows = self.rows

        files = self.files


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "tables": tables,
            "rows": rows,
            "files": files,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        tables = d.pop("tables")

        rows = d.pop("rows")

        files = d.pop("files")

        restore_result = cls(
            tables=tables,
            rows=rows,
            files=files,
        )

        return restore_result

