from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_pause import AgentPause
  from ..models.project_agent import ProjectAgent
  from ..models.project_agent_settings_review_statuses import ProjectAgentSettingsReviewStatuses





T = TypeVar("T", bound="ProjectAgentSettings")



@_attrs_define
class ProjectAgentSettings:
    """ 
        Attributes:
            sprint_approval (bool):
            approval_statuses (list[UUID]):
            paused (AgentPause | None):
            review_statuses (ProjectAgentSettingsReviewStatuses):
            agents (list[ProjectAgent]):
     """

    sprint_approval: bool
    approval_statuses: list[UUID]
    paused: AgentPause | None
    review_statuses: ProjectAgentSettingsReviewStatuses
    agents: list[ProjectAgent]





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_pause import AgentPause # noqa: PLC0415
        from ..models.project_agent import ProjectAgent # noqa: PLC0415
        from ..models.project_agent_settings_review_statuses import ProjectAgentSettingsReviewStatuses # noqa: PLC0415
        sprint_approval = self.sprint_approval

        approval_statuses = []
        for approval_statuses_item_data in self.approval_statuses:
            approval_statuses_item = str(approval_statuses_item_data)
            approval_statuses.append(approval_statuses_item)



        paused: dict[str, Any] | None
        if isinstance(self.paused, AgentPause):
            paused = self.paused.to_dict()
        else:
            paused = self.paused

        review_statuses = self.review_statuses.to_dict()

        agents = []
        for agents_item_data in self.agents:
            agents_item = agents_item_data.to_dict()
            agents.append(agents_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprintApproval": sprint_approval,
            "approvalStatuses": approval_statuses,
            "paused": paused,
            "reviewStatuses": review_statuses,
            "agents": agents,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_pause import AgentPause # noqa: PLC0415
        from ..models.project_agent import ProjectAgent # noqa: PLC0415
        from ..models.project_agent_settings_review_statuses import ProjectAgentSettingsReviewStatuses # noqa: PLC0415
        d = dict(src_dict)
        sprint_approval = d.pop("sprintApproval")

        approval_statuses = []
        _approval_statuses = d.pop("approvalStatuses")
        for approval_statuses_item_data in (_approval_statuses):
            approval_statuses_item = UUID(approval_statuses_item_data)



            approval_statuses.append(approval_statuses_item)


        def _parse_paused(data: object) -> AgentPause | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                paused_type_0 = AgentPause.from_dict(data)



                return paused_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentPause | None, data)

        paused = _parse_paused(d.pop("paused"))


        review_statuses = ProjectAgentSettingsReviewStatuses.from_dict(d.pop("reviewStatuses"))




        agents = []
        _agents = d.pop("agents")
        for agents_item_data in (_agents):
            agents_item = ProjectAgent.from_dict(agents_item_data)



            agents.append(agents_item)


        project_agent_settings = cls(
            sprint_approval=sprint_approval,
            approval_statuses=approval_statuses,
            paused=paused,
            review_statuses=review_statuses,
            agents=agents,
        )

        return project_agent_settings

