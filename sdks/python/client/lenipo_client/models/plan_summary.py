from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.plan_summary_projects_item import PlanSummaryProjectsItem
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PlanSummary")



@_attrs_define
class PlanSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            owner (None | UserRef):
            projects (list[PlanSummaryProjectsItem]):
            can_edit (bool):
     """

    id: UUID
    name: str
    description: str
    owner: None | UserRef
    projects: list[PlanSummaryProjectsItem]
    can_edit: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_summary_projects_item import PlanSummaryProjectsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        owner: dict[str, Any] | None
        if isinstance(self.owner, UserRef):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        can_edit = self.can_edit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "owner": owner,
            "projects": projects,
            "canEdit": can_edit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_summary_projects_item import PlanSummaryProjectsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        def _parse_owner(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = UserRef.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        owner = _parse_owner(d.pop("owner"))


        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = PlanSummaryProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        can_edit = d.pop("canEdit")

        plan_summary = cls(
            id=id,
            name=name,
            description=description,
            owner=owner,
            projects=projects,
            can_edit=can_edit,
        )

        return plan_summary

