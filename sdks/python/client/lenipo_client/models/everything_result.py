from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.everything_result_counts import EverythingResultCounts
  from ..models.everything_result_projects_item import EverythingResultProjectsItem
  from ..models.everything_result_spaces_item import EverythingResultSpacesItem
  from ..models.issue_hit import IssueHit
  from ..models.page_hit import PageHit





T = TypeVar("T", bound="EverythingResult")



@_attrs_define
class EverythingResult:
    """ 
        Attributes:
            counts (EverythingResultCounts):
            issues (list[IssueHit]):
            pages (list[PageHit]):
            projects (list[EverythingResultProjectsItem]):
            spaces (list[EverythingResultSpacesItem]):
     """

    counts: EverythingResultCounts
    issues: list[IssueHit]
    pages: list[PageHit]
    projects: list[EverythingResultProjectsItem]
    spaces: list[EverythingResultSpacesItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.everything_result_counts import EverythingResultCounts # noqa: PLC0415
        from ..models.everything_result_projects_item import EverythingResultProjectsItem # noqa: PLC0415
        from ..models.everything_result_spaces_item import EverythingResultSpacesItem # noqa: PLC0415
        from ..models.issue_hit import IssueHit # noqa: PLC0415
        from ..models.page_hit import PageHit # noqa: PLC0415
        counts = self.counts.to_dict()

        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        pages = []
        for pages_item_data in self.pages:
            pages_item = pages_item_data.to_dict()
            pages.append(pages_item)



        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        spaces = []
        for spaces_item_data in self.spaces:
            spaces_item = spaces_item_data.to_dict()
            spaces.append(spaces_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "counts": counts,
            "issues": issues,
            "pages": pages,
            "projects": projects,
            "spaces": spaces,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.everything_result_counts import EverythingResultCounts # noqa: PLC0415
        from ..models.everything_result_projects_item import EverythingResultProjectsItem # noqa: PLC0415
        from ..models.everything_result_spaces_item import EverythingResultSpacesItem # noqa: PLC0415
        from ..models.issue_hit import IssueHit # noqa: PLC0415
        from ..models.page_hit import PageHit # noqa: PLC0415
        d = dict(src_dict)
        counts = EverythingResultCounts.from_dict(d.pop("counts"))




        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = IssueHit.from_dict(issues_item_data)



            issues.append(issues_item)


        pages = []
        _pages = d.pop("pages")
        for pages_item_data in (_pages):
            pages_item = PageHit.from_dict(pages_item_data)



            pages.append(pages_item)


        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = EverythingResultProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        spaces = []
        _spaces = d.pop("spaces")
        for spaces_item_data in (_spaces):
            spaces_item = EverythingResultSpacesItem.from_dict(spaces_item_data)



            spaces.append(spaces_item)


        everything_result = cls(
            counts=counts,
            issues=issues,
            pages=pages,
            projects=projects,
            spaces=spaces,
        )

        return everything_result

