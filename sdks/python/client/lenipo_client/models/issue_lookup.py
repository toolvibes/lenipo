from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_type_info import IssueTypeInfo
  from ..models.status_info import StatusInfo





T = TypeVar("T", bound="IssueLookup")



@_attrs_define
class IssueLookup:
    """ 
        Attributes:
            key (str):
            summary (str):
            issue_type (IssueTypeInfo):
            status (StatusInfo):
     """

    key: str
    summary: str
    issue_type: IssueTypeInfo
    status: StatusInfo





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        key = self.key

        summary = self.summary

        issue_type = self.issue_type.to_dict()

        status = self.status.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "issueType": issue_type,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        issue_type = IssueTypeInfo.from_dict(d.pop("issueType"))




        status = StatusInfo.from_dict(d.pop("status"))




        issue_lookup = cls(
            key=key,
            summary=summary,
            issue_type=issue_type,
            status=status,
        )

        return issue_lookup

