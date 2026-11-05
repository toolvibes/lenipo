from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RetentionResult")



@_attrs_define
class RetentionResult:
    """ 
        Attributes:
            issues (int):
            pages (int):
            comments (int):
            versions (int):
            audit_entries (int):
            files (int):
            page_views (int):
            projects (int):
            spaces (int):
     """

    issues: int
    pages: int
    comments: int
    versions: int
    audit_entries: int
    files: int
    page_views: int
    projects: int
    spaces: int





    def to_dict(self) -> dict[str, Any]:
        issues = self.issues

        pages = self.pages

        comments = self.comments

        versions = self.versions

        audit_entries = self.audit_entries

        files = self.files

        page_views = self.page_views

        projects = self.projects

        spaces = self.spaces


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "pages": pages,
            "comments": comments,
            "versions": versions,
            "auditEntries": audit_entries,
            "files": files,
            "pageViews": page_views,
            "projects": projects,
            "spaces": spaces,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issues = d.pop("issues")

        pages = d.pop("pages")

        comments = d.pop("comments")

        versions = d.pop("versions")

        audit_entries = d.pop("auditEntries")

        files = d.pop("files")

        page_views = d.pop("pageViews")

        projects = d.pop("projects")

        spaces = d.pop("spaces")

        retention_result = cls(
            issues=issues,
            pages=pages,
            comments=comments,
            versions=versions,
            audit_entries=audit_entries,
            files=files,
            page_views=page_views,
            projects=projects,
            spaces=spaces,
        )

        return retention_result

