from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EverythingResultCounts")



@_attrs_define
class EverythingResultCounts:
    """ 
        Attributes:
            issue (int):
            page (int):
            project (int):
            space (int):
     """

    issue: int
    page: int
    project: int
    space: int





    def to_dict(self) -> dict[str, Any]:
        issue = self.issue

        page = self.page

        project = self.project

        space = self.space


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "page": page,
            "project": project,
            "space": space,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issue = d.pop("issue")

        page = d.pop("page")

        project = d.pop("project")

        space = d.pop("space")

        everything_result_counts = cls(
            issue=issue,
            page=page,
            project=project,
            space=space,
        )

        return everything_result_counts

