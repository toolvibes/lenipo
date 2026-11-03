from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.request_type_issue_type import RequestTypeIssueType





T = TypeVar("T", bound="RequestType")



@_attrs_define
class RequestType:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            issue_type (RequestTypeIssueType):
            fields (list[str]):
     """

    id: UUID
    name: str
    description: str
    issue_type: RequestTypeIssueType
    fields: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.request_type_issue_type import RequestTypeIssueType # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        issue_type = self.issue_type.to_dict()

        fields = self.fields




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "issueType": issue_type,
            "fields": fields,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.request_type_issue_type import RequestTypeIssueType # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        issue_type = RequestTypeIssueType.from_dict(d.pop("issueType"))




        fields = cast(list[str], d.pop("fields"))


        request_type = cls(
            id=id,
            name=name,
            description=description,
            issue_type=issue_type,
            fields=fields,
        )

        return request_type

