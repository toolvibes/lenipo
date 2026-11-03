from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.security_level import SecurityLevel
  from ..models.security_scheme_projects_item import SecuritySchemeProjectsItem





T = TypeVar("T", bound="SecurityScheme")



@_attrs_define
class SecurityScheme:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            projects (list[SecuritySchemeProjectsItem]):
            levels (list[SecurityLevel]):
            default_level_id (None | UUID):
     """

    id: UUID
    name: str
    description: str
    projects: list[SecuritySchemeProjectsItem]
    levels: list[SecurityLevel]
    default_level_id: None | UUID





    def to_dict(self) -> dict[str, Any]:
        from ..models.security_level import SecurityLevel # noqa: PLC0415
        from ..models.security_scheme_projects_item import SecuritySchemeProjectsItem # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        levels = []
        for levels_item_data in self.levels:
            levels_item = levels_item_data.to_dict()
            levels.append(levels_item)



        default_level_id: None | str
        if isinstance(self.default_level_id, UUID):
            default_level_id = str(self.default_level_id)
        else:
            default_level_id = self.default_level_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "projects": projects,
            "levels": levels,
            "defaultLevelId": default_level_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.security_level import SecurityLevel # noqa: PLC0415
        from ..models.security_scheme_projects_item import SecuritySchemeProjectsItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = SecuritySchemeProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        levels = []
        _levels = d.pop("levels")
        for levels_item_data in (_levels):
            levels_item = SecurityLevel.from_dict(levels_item_data)



            levels.append(levels_item)


        def _parse_default_level_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_level_id_type_0 = UUID(data)



                return default_level_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        default_level_id = _parse_default_level_id(d.pop("defaultLevelId"))


        security_scheme = cls(
            id=id,
            name=name,
            description=description,
            projects=projects,
            levels=levels,
            default_level_id=default_level_id,
        )

        return security_scheme

