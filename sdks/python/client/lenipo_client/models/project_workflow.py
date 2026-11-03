from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_workflow_mode import ProjectWorkflowMode
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.project_workflow_rules import ProjectWorkflowRules
  from ..models.project_workflow_transitions_item import ProjectWorkflowTransitionsItem
  from ..models.project_workflow_usage import ProjectWorkflowUsage
  from ..models.status_info import StatusInfo
  from ..models.workflow_draft import WorkflowDraft





T = TypeVar("T", bound="ProjectWorkflow")



@_attrs_define
class ProjectWorkflow:
    """ 
        Attributes:
            version_id (UUID):
            version (int):
            name (str):
            owned_by_project (bool):
            issue_type (None | str):
            inherited (bool):
            own_types (list[str]):
            draft (None | WorkflowDraft):
            mode (ProjectWorkflowMode):
            statuses (list[StatusInfo]):
            initial_status_id (UUID):
            transitions (list[ProjectWorkflowTransitionsItem]):
            rules (ProjectWorkflowRules):
            usage (ProjectWorkflowUsage):
            available (list[StatusInfo]):
     """

    version_id: UUID
    version: int
    name: str
    owned_by_project: bool
    issue_type: None | str
    inherited: bool
    own_types: list[str]
    draft: None | WorkflowDraft
    mode: ProjectWorkflowMode
    statuses: list[StatusInfo]
    initial_status_id: UUID
    transitions: list[ProjectWorkflowTransitionsItem]
    rules: ProjectWorkflowRules
    usage: ProjectWorkflowUsage
    available: list[StatusInfo]





    def to_dict(self) -> dict[str, Any]:
        from ..models.project_workflow_rules import ProjectWorkflowRules # noqa: PLC0415
        from ..models.project_workflow_transitions_item import ProjectWorkflowTransitionsItem # noqa: PLC0415
        from ..models.project_workflow_usage import ProjectWorkflowUsage # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.workflow_draft import WorkflowDraft # noqa: PLC0415
        version_id = str(self.version_id)

        version = self.version

        name = self.name

        owned_by_project = self.owned_by_project

        issue_type: None | str
        issue_type = self.issue_type

        inherited = self.inherited

        own_types = self.own_types



        draft: dict[str, Any] | None
        if isinstance(self.draft, WorkflowDraft):
            draft = self.draft.to_dict()
        else:
            draft = self.draft

        mode = self.mode.value

        statuses = []
        for statuses_item_data in self.statuses:
            statuses_item = statuses_item_data.to_dict()
            statuses.append(statuses_item)



        initial_status_id = str(self.initial_status_id)

        transitions = []
        for transitions_item_data in self.transitions:
            transitions_item = transitions_item_data.to_dict()
            transitions.append(transitions_item)



        rules = self.rules.to_dict()

        usage = self.usage.to_dict()

        available = []
        for available_item_data in self.available:
            available_item = available_item_data.to_dict()
            available.append(available_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "versionId": version_id,
            "version": version,
            "name": name,
            "ownedByProject": owned_by_project,
            "issueType": issue_type,
            "inherited": inherited,
            "ownTypes": own_types,
            "draft": draft,
            "mode": mode,
            "statuses": statuses,
            "initialStatusId": initial_status_id,
            "transitions": transitions,
            "rules": rules,
            "usage": usage,
            "available": available,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.project_workflow_rules import ProjectWorkflowRules # noqa: PLC0415
        from ..models.project_workflow_transitions_item import ProjectWorkflowTransitionsItem # noqa: PLC0415
        from ..models.project_workflow_usage import ProjectWorkflowUsage # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.workflow_draft import WorkflowDraft # noqa: PLC0415
        d = dict(src_dict)
        version_id = UUID(d.pop("versionId"))




        version = d.pop("version")

        name = d.pop("name")

        owned_by_project = d.pop("ownedByProject")

        def _parse_issue_type(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        issue_type = _parse_issue_type(d.pop("issueType"))


        inherited = d.pop("inherited")

        own_types = cast(list[str], d.pop("ownTypes"))


        def _parse_draft(data: object) -> None | WorkflowDraft:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                draft_type_0 = WorkflowDraft.from_dict(data)



                return draft_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | WorkflowDraft, data)

        draft = _parse_draft(d.pop("draft"))


        mode = ProjectWorkflowMode(d.pop("mode"))




        statuses = []
        _statuses = d.pop("statuses")
        for statuses_item_data in (_statuses):
            statuses_item = StatusInfo.from_dict(statuses_item_data)



            statuses.append(statuses_item)


        initial_status_id = UUID(d.pop("initialStatusId"))




        transitions = []
        _transitions = d.pop("transitions")
        for transitions_item_data in (_transitions):
            transitions_item = ProjectWorkflowTransitionsItem.from_dict(transitions_item_data)



            transitions.append(transitions_item)


        rules = ProjectWorkflowRules.from_dict(d.pop("rules"))




        usage = ProjectWorkflowUsage.from_dict(d.pop("usage"))




        available = []
        _available = d.pop("available")
        for available_item_data in (_available):
            available_item = StatusInfo.from_dict(available_item_data)



            available.append(available_item)


        project_workflow = cls(
            version_id=version_id,
            version=version,
            name=name,
            owned_by_project=owned_by_project,
            issue_type=issue_type,
            inherited=inherited,
            own_types=own_types,
            draft=draft,
            mode=mode,
            statuses=statuses,
            initial_status_id=initial_status_id,
            transitions=transitions,
            rules=rules,
            usage=usage,
            available=available,
        )

        return project_workflow

