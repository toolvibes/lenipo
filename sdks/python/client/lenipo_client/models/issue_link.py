from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_link_direction import IssueLinkDirection
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.issue_link_type_info import IssueLinkTypeInfo
  from ..models.linked_issue import LinkedIssue





T = TypeVar("T", bound="IssueLink")



@_attrs_define
class IssueLink:
    """ 
        Attributes:
            id (UUID):
            type_ (IssueLinkTypeInfo):
            direction (IssueLinkDirection):
            issue (LinkedIssue):
     """

    id: UUID
    type_: IssueLinkTypeInfo
    direction: IssueLinkDirection
    issue: LinkedIssue





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_link_type_info import IssueLinkTypeInfo # noqa: PLC0415
        from ..models.linked_issue import LinkedIssue # noqa: PLC0415
        id = str(self.id)

        type_ = self.type_.to_dict()

        direction = self.direction.value

        issue = self.issue.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "type": type_,
            "direction": direction,
            "issue": issue,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_link_type_info import IssueLinkTypeInfo # noqa: PLC0415
        from ..models.linked_issue import LinkedIssue # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        type_ = IssueLinkTypeInfo.from_dict(d.pop("type"))




        direction = IssueLinkDirection(d.pop("direction"))




        issue = LinkedIssue.from_dict(d.pop("issue"))




        issue_link = cls(
            id=id,
            type_=type_,
            direction=direction,
            issue=issue,
        )

        return issue_link

