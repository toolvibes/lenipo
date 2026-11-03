from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.space_permission import SpacePermission
from ..models.space_type import SpaceType
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.space_project_type_0 import SpaceProjectType0





T = TypeVar("T", bound="Space")



@_attrs_define
class Space:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            description (str):
            home_page_id (None | UUID):
            created_at (datetime.datetime):
            favourite (bool):
            watching (bool):
            project (None | SpaceProjectType0):
            type_ (SpaceType):
            approval_required (bool):
            permissions (list[SpacePermission]):
     """

    id: UUID
    key: str
    name: str
    description: str
    home_page_id: None | UUID
    created_at: datetime.datetime
    favourite: bool
    watching: bool
    project: None | SpaceProjectType0
    type_: SpaceType
    approval_required: bool
    permissions: list[SpacePermission]





    def to_dict(self) -> dict[str, Any]:
        from ..models.space_project_type_0 import SpaceProjectType0 # noqa: PLC0415
        id = str(self.id)

        key = self.key

        name = self.name

        description = self.description

        home_page_id: None | str
        if isinstance(self.home_page_id, UUID):
            home_page_id = str(self.home_page_id)
        else:
            home_page_id = self.home_page_id

        created_at = self.created_at.isoformat()

        favourite = self.favourite

        watching = self.watching

        project: dict[str, Any] | None
        if isinstance(self.project, SpaceProjectType0):
            project = self.project.to_dict()
        else:
            project = self.project

        type_ = self.type_.value

        approval_required = self.approval_required

        permissions = []
        for permissions_item_data in self.permissions:
            permissions_item = permissions_item_data.value
            permissions.append(permissions_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "description": description,
            "homePageId": home_page_id,
            "createdAt": created_at,
            "favourite": favourite,
            "watching": watching,
            "project": project,
            "type": type_,
            "approvalRequired": approval_required,
            "permissions": permissions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.space_project_type_0 import SpaceProjectType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        description = d.pop("description")

        def _parse_home_page_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                home_page_id_type_0 = UUID(data)



                return home_page_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        home_page_id = _parse_home_page_id(d.pop("homePageId"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        favourite = d.pop("favourite")

        watching = d.pop("watching")

        def _parse_project(data: object) -> None | SpaceProjectType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                project_type_0 = SpaceProjectType0.from_dict(data)



                return project_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SpaceProjectType0, data)

        project = _parse_project(d.pop("project"))


        type_ = SpaceType(d.pop("type"))




        approval_required = d.pop("approvalRequired")

        permissions = []
        _permissions = d.pop("permissions")
        for permissions_item_data in (_permissions):
            permissions_item = SpacePermission(permissions_item_data)



            permissions.append(permissions_item)


        space = cls(
            id=id,
            key=key,
            name=name,
            description=description,
            home_page_id=home_page_id,
            created_at=created_at,
            favourite=favourite,
            watching=watching,
            project=project,
            type_=type_,
            approval_required=approval_required,
            permissions=permissions,
        )

        return space

