from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary





T = TypeVar("T", bound="IssueList")



@_attrs_define
class IssueList:
    """ 
        Attributes:
            issues (list[IssueSummary]):
            total (int):
     """

    issues: list[IssueSummary]
    total: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        total = self.total


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "total": total,
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

        issue_list = cls(
            issues=issues,
            total=total,
        )

        return issue_list

