from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_development_branches_item import IssueDevelopmentBranchesItem
  from ..models.issue_development_builds_item import IssueDevelopmentBuildsItem
  from ..models.issue_development_commits import IssueDevelopmentCommits
  from ..models.issue_development_pull_requests_item import IssueDevelopmentPullRequestsItem





T = TypeVar("T", bound="IssueDevelopment")



@_attrs_define
class IssueDevelopment:
    """ 
        Attributes:
            branches (list[IssueDevelopmentBranchesItem]):
            commits (IssueDevelopmentCommits):
            pull_requests (list[IssueDevelopmentPullRequestsItem]):
            builds (list[IssueDevelopmentBuildsItem]):
     """

    branches: list[IssueDevelopmentBranchesItem]
    commits: IssueDevelopmentCommits
    pull_requests: list[IssueDevelopmentPullRequestsItem]
    builds: list[IssueDevelopmentBuildsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_development_branches_item import IssueDevelopmentBranchesItem # noqa: PLC0415
        from ..models.issue_development_builds_item import IssueDevelopmentBuildsItem # noqa: PLC0415
        from ..models.issue_development_commits import IssueDevelopmentCommits # noqa: PLC0415
        from ..models.issue_development_pull_requests_item import IssueDevelopmentPullRequestsItem # noqa: PLC0415
        branches = []
        for branches_item_data in self.branches:
            branches_item = branches_item_data.to_dict()
            branches.append(branches_item)



        commits = self.commits.to_dict()

        pull_requests = []
        for pull_requests_item_data in self.pull_requests:
            pull_requests_item = pull_requests_item_data.to_dict()
            pull_requests.append(pull_requests_item)



        builds = []
        for builds_item_data in self.builds:
            builds_item = builds_item_data.to_dict()
            builds.append(builds_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "branches": branches,
            "commits": commits,
            "pullRequests": pull_requests,
            "builds": builds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_development_branches_item import IssueDevelopmentBranchesItem # noqa: PLC0415
        from ..models.issue_development_builds_item import IssueDevelopmentBuildsItem # noqa: PLC0415
        from ..models.issue_development_commits import IssueDevelopmentCommits # noqa: PLC0415
        from ..models.issue_development_pull_requests_item import IssueDevelopmentPullRequestsItem # noqa: PLC0415
        d = dict(src_dict)
        branches = []
        _branches = d.pop("branches")
        for branches_item_data in (_branches):
            branches_item = IssueDevelopmentBranchesItem.from_dict(branches_item_data)



            branches.append(branches_item)


        commits = IssueDevelopmentCommits.from_dict(d.pop("commits"))




        pull_requests = []
        _pull_requests = d.pop("pullRequests")
        for pull_requests_item_data in (_pull_requests):
            pull_requests_item = IssueDevelopmentPullRequestsItem.from_dict(pull_requests_item_data)



            pull_requests.append(pull_requests_item)


        builds = []
        _builds = d.pop("builds")
        for builds_item_data in (_builds):
            builds_item = IssueDevelopmentBuildsItem.from_dict(builds_item_data)



            builds.append(builds_item)


        issue_development = cls(
            branches=branches,
            commits=commits,
            pull_requests=pull_requests,
            builds=builds,
        )

        return issue_development

