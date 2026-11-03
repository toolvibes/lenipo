from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.publish_workflow_request_mode import PublishWorkflowRequestMode
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.publish_workflow_request_migrate import PublishWorkflowRequestMigrate
  from ..models.publish_workflow_request_statuses_item import PublishWorkflowRequestStatusesItem
  from ..models.publish_workflow_request_transitions_item import PublishWorkflowRequestTransitionsItem





T = TypeVar("T", bound="PublishWorkflowRequest")



@_attrs_define
class PublishWorkflowRequest:
    """ 
        Attributes:
            base_version_id (UUID):
            statuses (list[PublishWorkflowRequestStatusesItem]):
            initial (int):
            mode (PublishWorkflowRequestMode):
            transitions (list[PublishWorkflowRequestTransitionsItem]):
            migrate (PublishWorkflowRequestMigrate):
            issue_type (str | Unset):
     """

    base_version_id: UUID
    statuses: list[PublishWorkflowRequestStatusesItem]
    initial: int
    mode: PublishWorkflowRequestMode
    transitions: list[PublishWorkflowRequestTransitionsItem]
    migrate: PublishWorkflowRequestMigrate
    issue_type: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.publish_workflow_request_migrate import PublishWorkflowRequestMigrate # noqa: PLC0415
        from ..models.publish_workflow_request_statuses_item import PublishWorkflowRequestStatusesItem # noqa: PLC0415
        from ..models.publish_workflow_request_transitions_item import PublishWorkflowRequestTransitionsItem # noqa: PLC0415
        base_version_id = str(self.base_version_id)

        statuses = []
        for statuses_item_data in self.statuses:
            statuses_item = statuses_item_data.to_dict()
            statuses.append(statuses_item)



        initial = self.initial

        mode = self.mode.value

        transitions = []
        for transitions_item_data in self.transitions:
            transitions_item = transitions_item_data.to_dict()
            transitions.append(transitions_item)



        migrate = self.migrate.to_dict()

        issue_type = self.issue_type


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "baseVersionId": base_version_id,
            "statuses": statuses,
            "initial": initial,
            "mode": mode,
            "transitions": transitions,
            "migrate": migrate,
        })
        if issue_type is not UNSET:
            field_dict["issueType"] = issue_type

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.publish_workflow_request_migrate import PublishWorkflowRequestMigrate # noqa: PLC0415
        from ..models.publish_workflow_request_statuses_item import PublishWorkflowRequestStatusesItem # noqa: PLC0415
        from ..models.publish_workflow_request_transitions_item import PublishWorkflowRequestTransitionsItem # noqa: PLC0415
        d = dict(src_dict)
        base_version_id = UUID(d.pop("baseVersionId"))




        statuses = []
        _statuses = d.pop("statuses")
        for statuses_item_data in (_statuses):
            statuses_item = PublishWorkflowRequestStatusesItem.from_dict(statuses_item_data)



            statuses.append(statuses_item)


        initial = d.pop("initial")

        mode = PublishWorkflowRequestMode(d.pop("mode"))




        transitions = []
        _transitions = d.pop("transitions")
        for transitions_item_data in (_transitions):
            transitions_item = PublishWorkflowRequestTransitionsItem.from_dict(transitions_item_data)



            transitions.append(transitions_item)


        migrate = PublishWorkflowRequestMigrate.from_dict(d.pop("migrate"))




        issue_type = d.pop("issueType", UNSET)

        publish_workflow_request = cls(
            base_version_id=base_version_id,
            statuses=statuses,
            initial=initial,
            mode=mode,
            transitions=transitions,
            migrate=migrate,
            issue_type=issue_type,
        )

        return publish_workflow_request

