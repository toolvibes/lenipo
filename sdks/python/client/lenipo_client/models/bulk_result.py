from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.bulk_result_results_item import BulkResultResultsItem





T = TypeVar("T", bound="BulkResult")



@_attrs_define
class BulkResult:
    """ 
        Attributes:
            results (list[BulkResultResultsItem]):
     """

    results: list[BulkResultResultsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.bulk_result_results_item import BulkResultResultsItem # noqa: PLC0415
        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "results": results,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bulk_result_results_item import BulkResultResultsItem # noqa: PLC0415
        d = dict(src_dict)
        results = []
        _results = d.pop("results")
        for results_item_data in (_results):
            results_item = BulkResultResultsItem.from_dict(results_item_data)



            results.append(results_item)


        bulk_result = cls(
            results=results,
        )

        return bulk_result

