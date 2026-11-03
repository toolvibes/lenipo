from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_role import AgentRole
from ..models.project_permission import ProjectPermission
from typing import cast






T = TypeVar("T", bound="AgentRightsProjectsItem")



@_attrs_define
class AgentRightsProjectsItem:
    """ 
        Attributes:
            key (str):
            name (str):
            permissions (list[ProjectPermission]):
            roles (list[AgentRole]):
            paused (bool):
     """

    key: str
    name: str
    permissions: list[ProjectPermission]
    roles: list[AgentRole]
    paused: bool





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name

        permissions = []
        for permissions_item_data in self.permissions:
            permissions_item = permissions_item_data.value
            permissions.append(permissions_item)



        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)



        paused = self.paused


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "permissions": permissions,
            "roles": roles,
            "paused": paused,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        permissions = []
        _permissions = d.pop("permissions")
        for permissions_item_data in (_permissions):
            permissions_item = ProjectPermission(permissions_item_data)



            permissions.append(permissions_item)


        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = AgentRole(roles_item_data)



            roles.append(roles_item)


        paused = d.pop("paused")

        agent_rights_projects_item = cls(
            key=key,
            name=name,
            permissions=permissions,
            roles=roles,
            paused=paused,
        )

        return agent_rights_projects_item

