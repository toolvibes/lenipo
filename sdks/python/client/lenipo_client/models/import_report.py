from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.import_report_counts import ImportReportCounts





T = TypeVar("T", bound="ImportReport")



@_attrs_define
class ImportReport:
    """ 
        Attributes:
            counts (ImportReportCounts):
            mappings (list[str]):
            skipped (list[str]):
     """

    counts: ImportReportCounts
    mappings: list[str]
    skipped: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.import_report_counts import ImportReportCounts # noqa: PLC0415
        counts = self.counts.to_dict()

        mappings = self.mappings



        skipped = self.skipped




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "counts": counts,
            "mappings": mappings,
            "skipped": skipped,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.import_report_counts import ImportReportCounts # noqa: PLC0415
        d = dict(src_dict)
        counts = ImportReportCounts.from_dict(d.pop("counts"))




        mappings = cast(list[str], d.pop("mappings"))


        skipped = cast(list[str], d.pop("skipped"))


        import_report = cls(
            counts=counts,
            mappings=mappings,
            skipped=skipped,
        )

        return import_report

