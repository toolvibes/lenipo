from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.statistic_field import StatisticField
from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigType5")



@_attrs_define
class ReportConfigType5:
    """ 
        Attributes:
            kind (Literal['pie']):
            query (str):
            field (StatisticField):
     """

    kind: Literal['pie']
    query: str
    field: StatisticField





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        field = self.field.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "query": query,
            "field": field,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['pie'] , d.pop("kind"))
        if kind != 'pie':
            raise ValueError(f"kind must match const 'pie', got '{kind}'")

        query = d.pop("query")

        field = StatisticField(d.pop("field"))




        report_config_type_5 = cls(
            kind=kind,
            query=query,
            field=field,
        )

        return report_config_type_5

