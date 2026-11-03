from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary
  from ..models.sprint import Sprint





T = TypeVar("T", bound="BacklogDataSprintsItem")



@_attrs_define
class BacklogDataSprintsItem:
    """ 
        Attributes:
            sprint (Sprint):
            issues (list[IssueSummary]):
     """

    sprint: Sprint
    issues: list[IssueSummary]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        sprint = self.sprint.to_dict()

        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprint": sprint,
            "issues": issues,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.sprint import Sprint # noqa: PLC0415
        d = dict(src_dict)
        sprint = Sprint.from_dict(d.pop("sprint"))




        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = IssueSummary.from_dict(issues_item_data)



            issues.append(issues_item)


        backlog_data_sprints_item = cls(
            sprint=sprint,
            issues=issues,
        )

        return backlog_data_sprints_item

