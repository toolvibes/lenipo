from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary





T = TypeVar("T", bound="SearchResult")



@_attrs_define
class SearchResult:
    """ 
        Attributes:
            issues (list[IssueSummary]):
            total (int):
            total_capped (bool):
            limit (int):
            offset (int):
     """

    issues: list[IssueSummary]
    total: int
    total_capped: bool
    limit: int
    offset: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        total = self.total

        total_capped = self.total_capped

        limit = self.limit

        offset = self.offset


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "total": total,
            "totalCapped": total_capped,
            "limit": limit,
            "offset": offset,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        d = dict(src_dict)
        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = IssueSummary.from_dict(issues_item_data)



            issues.append(issues_item)


        total = d.pop("total")

        total_capped = d.pop("totalCapped")

        limit = d.pop("limit")

        offset = d.pop("offset")

        search_result = cls(
            issues=issues,
            total=total,
            total_capped=total_capped,
            limit=limit,
            offset=offset,
        )

        return search_result

