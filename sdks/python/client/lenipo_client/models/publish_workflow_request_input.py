from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.publish_workflow_request_input_mode import PublishWorkflowRequestInputMode
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.publish_workflow_request_input_migrate import PublishWorkflowRequestInputMigrate
  from ..models.publish_workflow_request_input_statuses_item import PublishWorkflowRequestInputStatusesItem
  from ..models.publish_workflow_request_input_transitions_item import PublishWorkflowRequestInputTransitionsItem





T = TypeVar("T", bound="PublishWorkflowRequestInput")



@_attrs_define
class PublishWorkflowRequestInput:
    """ 
        Attributes:
            base_version_id (UUID):
            statuses (list[PublishWorkflowRequestInputStatusesItem]):
            initial (int):
            mode (PublishWorkflowRequestInputMode):
            issue_type (str | Unset):
            transitions (list[PublishWorkflowRequestInputTransitionsItem] | Unset):
            migrate (PublishWorkflowRequestInputMigrate | Unset):
     """

    base_version_id: UUID
    statuses: list[PublishWorkflowRequestInputStatusesItem]
    initial: int
    mode: PublishWorkflowRequestInputMode
    issue_type: str | Unset = UNSET
    transitions: list[PublishWorkflowRequestInputTransitionsItem] | Unset = UNSET
    migrate: PublishWorkflowRequestInputMigrate | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.publish_workflow_request_input_migrate import PublishWorkflowRequestInputMigrate # noqa: PLC0415
        from ..models.publish_workflow_request_input_statuses_item import PublishWorkflowRequestInputStatusesItem # noqa: PLC0415
        from ..models.publish_workflow_request_input_transitions_item import PublishWorkflowRequestInputTransitionsItem # noqa: PLC0415
        base_version_id = str(self.base_version_id)

        statuses = []
        for statuses_item_data in self.statuses:
            statuses_item = statuses_item_data.to_dict()
            statuses.append(statuses_item)



        initial = self.initial

        mode = self.mode.value

        issue_type = self.issue_type

        transitions: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.transitions, Unset):
            transitions = []
            for transitions_item_data in self.transitions:
                transitions_item = transitions_item_data.to_dict()
                transitions.append(transitions_item)



        migrate: dict[str, Any] | Unset = UNSET
        if not isinstance(self.migrate, Unset):
            migrate = self.migrate.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "baseVersionId": base_version_id,
            "statuses": statuses,
            "initial": initial,
            "mode": mode,
        })
        if issue_type is not UNSET:
            field_dict["issueType"] = issue_type
        if transitions is not UNSET:
            field_dict["transitions"] = transitions
        if migrate is not UNSET:
            field_dict["migrate"] = migrate

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.publish_workflow_request_input_migrate import PublishWorkflowRequestInputMigrate # noqa: PLC0415
        from ..models.publish_workflow_request_input_statuses_item import PublishWorkflowRequestInputStatusesItem # noqa: PLC0415
        from ..models.publish_workflow_request_input_transitions_item import PublishWorkflowRequestInputTransitionsItem # noqa: PLC0415
        d = dict(src_dict)
        base_version_id = UUID(d.pop("baseVersionId"))




        statuses = []
        _statuses = d.pop("statuses")
        for statuses_item_data in (_statuses):
            statuses_item = PublishWorkflowRequestInputStatusesItem.from_dict(statuses_item_data)



            statuses.append(statuses_item)


        initial = d.pop("initial")

        mode = PublishWorkflowRequestInputMode(d.pop("mode"))




        issue_type = d.pop("issueType", UNSET)

        _transitions = d.pop("transitions", UNSET)
        transitions: list[PublishWorkflowRequestInputTransitionsItem] | Unset = UNSET
        if _transitions is not UNSET:
            transitions = []
            for transitions_item_data in _transitions:
                transitions_item = PublishWorkflowRequestInputTransitionsItem.from_dict(transitions_item_data)



                transitions.append(transitions_item)


        _migrate = d.pop("migrate", UNSET)
        migrate: PublishWorkflowRequestInputMigrate | Unset
        if isinstance(_migrate,  Unset):
            migrate = UNSET
        else:
            migrate = PublishWorkflowRequestInputMigrate.from_dict(_migrate)




        publish_workflow_request_input = cls(
            base_version_id=base_version_id,
            statuses=statuses,
            initial=initial,
            mode=mode,
            issue_type=issue_type,
            transitions=transitions,
            migrate=migrate,
        )


        publish_workflow_request_input.additional_properties = d
        return publish_workflow_request_input

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
