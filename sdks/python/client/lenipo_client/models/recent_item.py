from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.recent_kind import RecentKind
from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary





T = TypeVar("T", bound="RecentItem")



@_attrs_define
class RecentItem:
    """ 
        Attributes:
            kind (RecentKind):
            ref (str):
            name (str):
            viewed_at (datetime.datetime):
            space_key (str | Unset):
            project_key (str | Unset):
            issue (IssueSummary | Unset):
     """

    kind: RecentKind
    ref: str
    name: str
    viewed_at: datetime.datetime
    space_key: str | Unset = UNSET
    project_key: str | Unset = UNSET
    issue: IssueSummary | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        kind = self.kind.value

        ref = self.ref

        name = self.name

        viewed_at = self.viewed_at.isoformat()

        space_key = self.space_key

        project_key = self.project_key

        issue: dict[str, Any] | Unset = UNSET
        if not isinstance(self.issue, Unset):
            issue = self.issue.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "ref": ref,
            "name": name,
            "viewedAt": viewed_at,
        })
        if space_key is not UNSET:
            field_dict["spaceKey"] = space_key
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key
        if issue is not UNSET:
            field_dict["issue"] = issue

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        d = dict(src_dict)
        kind = RecentKind(d.pop("kind"))




        ref = d.pop("ref")

        name = d.pop("name")

        viewed_at = datetime.datetime.fromisoformat(d.pop("viewedAt"))




        space_key = d.pop("spaceKey", UNSET)

        project_key = d.pop("projectKey", UNSET)

        _issue = d.pop("issue", UNSET)
        issue: IssueSummary | Unset
        if isinstance(_issue,  Unset):
            issue = UNSET
        else:
            issue = IssueSummary.from_dict(_issue)




        recent_item = cls(
            kind=kind,
            ref=ref,
            name=name,
            viewed_at=viewed_at,
            space_key=space_key,
            project_key=project_key,
            issue=issue,
        )

        return recent_item

