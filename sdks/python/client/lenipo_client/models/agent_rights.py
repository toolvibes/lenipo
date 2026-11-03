from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent_rights_projects_item import AgentRightsProjectsItem
  from ..models.agent_rights_tokens_item import AgentRightsTokensItem





T = TypeVar("T", bound="AgentRights")



@_attrs_define
class AgentRights:
    """ 
        Attributes:
            groups (list[str]):
            projects (list[AgentRightsProjectsItem]):
            tokens (list[AgentRightsTokensItem]):
     """

    groups: list[str]
    projects: list[AgentRightsProjectsItem]
    tokens: list[AgentRightsTokensItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_rights_projects_item import AgentRightsProjectsItem # noqa: PLC0415
        from ..models.agent_rights_tokens_item import AgentRightsTokensItem # noqa: PLC0415
        groups = self.groups



        projects = []
        for projects_item_data in self.projects:
            projects_item = projects_item_data.to_dict()
            projects.append(projects_item)



        tokens = []
        for tokens_item_data in self.tokens:
            tokens_item = tokens_item_data.to_dict()
            tokens.append(tokens_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "groups": groups,
            "projects": projects,
            "tokens": tokens,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_rights_projects_item import AgentRightsProjectsItem # noqa: PLC0415
        from ..models.agent_rights_tokens_item import AgentRightsTokensItem # noqa: PLC0415
        d = dict(src_dict)
        groups = cast(list[str], d.pop("groups"))


        projects = []
        _projects = d.pop("projects")
        for projects_item_data in (_projects):
            projects_item = AgentRightsProjectsItem.from_dict(projects_item_data)



            projects.append(projects_item)


        tokens = []
        _tokens = d.pop("tokens")
        for tokens_item_data in (_tokens):
            tokens_item = AgentRightsTokensItem.from_dict(tokens_item_data)



            tokens.append(tokens_item)


        agent_rights = cls(
            groups=groups,
            projects=projects,
            tokens=tokens,
        )

        return agent_rights

