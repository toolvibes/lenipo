from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigType0")



@_attrs_define
class ReportConfigType0:
    """ 
        Attributes:
            kind (Literal['cfd']):
            query (str):
            days (int):  Default: 30.
     """

    kind: Literal['cfd']
    query: str
    days: int = 30





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        days = self.days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "query": query,
            "days": days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['cfd'] , d.pop("kind"))
        if kind != 'cfd':
            raise ValueError(f"kind must match const 'cfd', got '{kind}'")

        query = d.pop("query")

        days = d.pop("days")

        report_config_type_0 = cls(
            kind=kind,
            query=query,
            days=days,
        )

        return report_config_type_0

