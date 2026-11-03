from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_approval import IssueApproval
  from ..models.sprint_approval import SprintApproval





T = TypeVar("T", bound="PendingApprovals")



@_attrs_define
class PendingApprovals:
    """ 
        Attributes:
            sprints (list[SprintApproval]):
            issues (list[IssueApproval]):
     """

    sprints: list[SprintApproval]
    issues: list[IssueApproval]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_approval import IssueApproval # noqa: PLC0415
        from ..models.sprint_approval import SprintApproval # noqa: PLC0415
        sprints = []
        for sprints_item_data in self.sprints:
            sprints_item = sprints_item_data.to_dict()
            sprints.append(sprints_item)



        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprints": sprints,
            "issues": issues,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_approval import IssueApproval # noqa: PLC0415
        from ..models.sprint_approval import SprintApproval # noqa: PLC0415
        d = dict(src_dict)
        sprints = []
        _sprints = d.pop("sprints")
        for sprints_item_data in (_sprints):
            sprints_item = SprintApproval.from_dict(sprints_item_data)



            sprints.append(sprints_item)


        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = IssueApproval.from_dict(issues_item_data)



            issues.append(issues_item)


        pending_approvals = cls(
            sprints=sprints,
            issues=issues,
        )

        return pending_approvals

