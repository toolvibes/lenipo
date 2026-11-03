from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.series_field import SeriesField
from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigType1")



@_attrs_define
class ReportConfigType1:
    """ 
        Attributes:
            kind (Literal['field-series']):
            query (str):
            field (SeriesField):
            days (int):  Default: 30.
     """

    kind: Literal['field-series']
    query: str
    field: SeriesField
    days: int = 30





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        field = self.field.value

        days = self.days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "query": query,
            "field": field,
            "days": days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['field-series'] , d.pop("kind"))
        if kind != 'field-series':
            raise ValueError(f"kind must match const 'field-series', got '{kind}'")

        query = d.pop("query")

        field = SeriesField(d.pop("field"))




        days = d.pop("days")

        report_config_type_1 = cls(
            kind=kind,
            query=query,
            field=field,
            days=days,
        )

        return report_config_type_1

