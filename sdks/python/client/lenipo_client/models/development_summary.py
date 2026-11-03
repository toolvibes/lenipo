from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DevelopmentSummary")



@_attrs_define
class DevelopmentSummary:
    """ 
        Attributes:
            issue_key (str):
            open_pull_requests (int):
            merged_pull_requests (int):
            failing_builds (int):
     """

    issue_key: str
    open_pull_requests: int
    merged_pull_requests: int
    failing_builds: int





    def to_dict(self) -> dict[str, Any]:
        issue_key = self.issue_key

        open_pull_requests = self.open_pull_requests

        merged_pull_requests = self.merged_pull_requests

        failing_builds = self.failing_builds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issueKey": issue_key,
            "openPullRequests": open_pull_requests,
            "mergedPullRequests": merged_pull_requests,
            "failingBuilds": failing_builds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issue_key = d.pop("issueKey")

        open_pull_requests = d.pop("openPullRequests")

        merged_pull_requests = d.pop("mergedPullRequests")

        failing_builds = d.pop("failingBuilds")

        development_summary = cls(
            issue_key=issue_key,
            open_pull_requests=open_pull_requests,
            merged_pull_requests=merged_pull_requests,
            failing_builds=failing_builds,
        )

        return development_summary

