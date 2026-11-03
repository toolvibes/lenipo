from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Component")



@_attrs_define
class Component:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            lead (None | UserRef):
            default_assignee (None | UserRef):
            issue_count (int):
     """

    id: UUID
    name: str
    description: str
    lead: None | UserRef
    default_assignee: None | UserRef
    issue_count: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        lead: dict[str, Any] | None
        if isinstance(self.lead, UserRef):
            lead = self.lead.to_dict()
        else:
            lead = self.lead

        default_assignee: dict[str, Any] | None
        if isinstance(self.default_assignee, UserRef):
            default_assignee = self.default_assignee.to_dict()
        else:
            default_assignee = self.default_assignee

        issue_count = self.issue_count


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "lead": lead,
            "defaultAssignee": default_assignee,
            "issueCount": issue_count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

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


        def _parse_default_assignee(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                default_assignee_type_0 = UserRef.from_dict(data)



                return default_assignee_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        default_assignee = _parse_default_assignee(d.pop("defaultAssignee"))


        issue_count = d.pop("issueCount")

        component = cls(
            id=id,
            name=name,
            description=description,
            lead=lead,
            default_assignee=default_assignee,
            issue_count=issue_count,
        )

        return component

