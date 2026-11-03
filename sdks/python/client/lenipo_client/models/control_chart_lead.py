from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ControlChartLead")



@_attrs_define
class ControlChartLead:
    """ 
        Attributes:
            average (float | None):
            median (float | None):
            p85 (float | None):
     """

    average: float | None
    median: float | None
    p85: float | None





    def to_dict(self) -> dict[str, Any]:
        average: float | None
        average = self.average

        median: float | None
        median = self.median

        p85: float | None
        p85 = self.p85


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "average": average,
            "median": median,
            "p85": p85,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_average(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        average = _parse_average(d.pop("average"))


        def _parse_median(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        median = _parse_median(d.pop("median"))


        def _parse_p85(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        p85 = _parse_p85(d.pop("p85"))


        control_chart_lead = cls(
            average=average,
            median=median,
            p85=p85,
        )

        return control_chart_lead

