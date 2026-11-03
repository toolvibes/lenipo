from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_template import ProjectTemplate
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ProjectSummary")



@_attrs_define
class ProjectSummary:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            description (str):
            template (ProjectTemplate):
            lead (None | UserRef):
            issue_count (int):
            created_at (datetime.datetime):
            favourite (bool):
     """

    id: UUID
    key: str
    name: str
    description: str
    template: ProjectTemplate
    lead: None | UserRef
    issue_count: int
    created_at: datetime.datetime
    favourite: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        key = self.key

        name = self.name

        description = self.description

        template = self.template.value

        lead: dict[str, Any] | None
        if isinstance(self.lead, UserRef):
            lead = self.lead.to_dict()
        else:
            lead = self.lead

        issue_count = self.issue_count

        created_at = self.created_at.isoformat()

        favourite = self.favourite


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "description": description,
            "template": template,
            "lead": lead,
            "issueCount": issue_count,
            "createdAt": created_at,
            "favourite": favourite,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        description = d.pop("description")

        template = ProjectTemplate(d.pop("template"))




        def _parse_lead(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                lead_type_0 = UserRef.from_dict(data)



                return lead_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        lead = _parse_lead(d.pop("lead"))


        issue_count = d.pop("issueCount")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        favourite = d.pop("favourite")

        project_summary = cls(
            id=id,
            key=key,
            name=name,
            description=description,
            template=template,
            lead=lead,
            issue_count=issue_count,
            created_at=created_at,
            favourite=favourite,
        )

        return project_summary

