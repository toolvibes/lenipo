from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.permission_grant import PermissionGrant
  from ..models.permission_scheme_projects_item import PermissionSchemeProjectsItem





T = TypeVar("T", bound="PermissionScheme")



@_attrs_define
class PermissionScheme:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            is_default (bool):
            projects (list[PermissionSchemeProjectsItem]):
            grants (list[PermissionGrant]):
     """

    id: UUID
    name: str
    description: str
    is_default: bool
    projects: list[PermissionSchemeProjectsItem]
    grants: list[PermissionGrant]





    def to_dict(self) -> dict[str, Any]:
        from ..models.permission_grant import PermissionGrant # noqa: PLC0415
        from ..models.permission_scheme_projects_item import PermissionSchemeProjectsItem # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        is_default = self.is_default

        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        grants = []
        for grants_item_data in self.grants:
            grants_item = grants_item_data.to_dict()
            grants.append(grants_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "isDefault": is_default,
            "projects": projects,
            "grants": grants,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.permission_grant import PermissionGrant # noqa: PLC0415
        from ..models.permission_scheme_projects_item import PermissionSchemeProjectsItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        is_default = d.pop("isDefault")

        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = PermissionSchemeProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        grants = []
        _grants = d.pop("grants")
        for grants_item_data in (_grants):
            grants_item = PermissionGrant.from_dict(grants_item_data)



            grants.append(grants_item)


        permission_scheme = cls(
            id=id,
            name=name,
            description=description,
            is_default=is_default,
            projects=projects,
            grants=grants,
        )

        return permission_scheme

