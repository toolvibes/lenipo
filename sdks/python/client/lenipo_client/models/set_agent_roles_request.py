from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_role import AgentRole
from typing import cast






T = TypeVar("T", bound="SetAgentRolesRequest")



@_attrs_define
class SetAgentRolesRequest:
    """ 
        Attributes:
            roles (list[AgentRole]):
     """

    roles: list[AgentRole]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "roles": roles,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = AgentRole(roles_item_data)



            roles.append(roles_item)


        set_agent_roles_request = cls(
            roles=roles,
        )


        set_agent_roles_request.additional_properties = d
        return set_agent_roles_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
