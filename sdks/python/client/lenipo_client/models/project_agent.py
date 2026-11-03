from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_role import AgentRole
from typing import cast

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ProjectAgent")



@_attrs_define
class ProjectAgent:
    """ 
        Attributes:
            agent (UserRef):
            vendor (str):
            roles (list[AgentRole]):
     """

    agent: UserRef
    vendor: str
    roles: list[AgentRole]





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        agent = self.agent.to_dict()

        vendor = self.vendor

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent": agent,
            "vendor": vendor,
            "roles": roles,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        agent = UserRef.from_dict(d.pop("agent"))




        vendor = d.pop("vendor")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = AgentRole(roles_item_data)



            roles.append(roles_item)


        project_agent = cls(
            agent=agent,
            vendor=vendor,
            roles=roles,
        )

        return project_agent

