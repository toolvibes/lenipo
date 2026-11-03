from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.notification_scheme_summary_projects_item import NotificationSchemeSummaryProjectsItem





T = TypeVar("T", bound="NotificationSchemeSummary")



@_attrs_define
class NotificationSchemeSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            is_default (bool):
            projects (list[NotificationSchemeSummaryProjectsItem]):
     """

    id: UUID
    name: str
    description: str
    is_default: bool
    projects: list[NotificationSchemeSummaryProjectsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.notification_scheme_summary_projects_item import NotificationSchemeSummaryProjectsItem # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        is_default = self.is_default

        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "isDefault": is_default,
            "projects": projects,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification_scheme_summary_projects_item import NotificationSchemeSummaryProjectsItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        is_default = d.pop("isDefault")

        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = NotificationSchemeSummaryProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        notification_scheme_summary = cls(
            id=id,
            name=name,
            description=description,
            is_default=is_default,
            projects=projects,
        )

        return notification_scheme_summary

