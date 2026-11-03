from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.update_project_agent_settings_review_statuses import UpdateProjectAgentSettingsReviewStatuses





T = TypeVar("T", bound="UpdateProjectAgentSettings")



@_attrs_define
class UpdateProjectAgentSettings:
    """ 
        Attributes:
            sprint_approval (bool | Unset):
            approval_statuses (list[UUID] | Unset):
            review_statuses (UpdateProjectAgentSettingsReviewStatuses | Unset):
     """

    sprint_approval: bool | Unset = UNSET
    approval_statuses: list[UUID] | Unset = UNSET
    review_statuses: UpdateProjectAgentSettingsReviewStatuses | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_project_agent_settings_review_statuses import UpdateProjectAgentSettingsReviewStatuses # noqa: PLC0415
        sprint_approval = self.sprint_approval

        approval_statuses: list[str] | Unset = UNSET
        if not isinstance(self.approval_statuses, Unset):
            approval_statuses = []
            for approval_statuses_item_data in self.approval_statuses:
                approval_statuses_item = str(approval_statuses_item_data)
                approval_statuses.append(approval_statuses_item)



        review_statuses: dict[str, Any] | Unset = UNSET
        if not isinstance(self.review_statuses, Unset):
            review_statuses = self.review_statuses.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if sprint_approval is not UNSET:
            field_dict["sprintApproval"] = sprint_approval
        if approval_statuses is not UNSET:
            field_dict["approvalStatuses"] = approval_statuses
        if review_statuses is not UNSET:
            field_dict["reviewStatuses"] = review_statuses

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_project_agent_settings_review_statuses import UpdateProjectAgentSettingsReviewStatuses # noqa: PLC0415
        d = dict(src_dict)
        sprint_approval = d.pop("sprintApproval", UNSET)

        _approval_statuses = d.pop("approvalStatuses", UNSET)
        approval_statuses: list[UUID] | Unset = UNSET
        if _approval_statuses is not UNSET:
            approval_statuses = []
            for approval_statuses_item_data in _approval_statuses:
                approval_statuses_item = UUID(approval_statuses_item_data)



                approval_statuses.append(approval_statuses_item)


        _review_statuses = d.pop("reviewStatuses", UNSET)
        review_statuses: UpdateProjectAgentSettingsReviewStatuses | Unset
        if isinstance(_review_statuses,  Unset):
            review_statuses = UNSET
        else:
            review_statuses = UpdateProjectAgentSettingsReviewStatuses.from_dict(_review_statuses)




        update_project_agent_settings = cls(
            sprint_approval=sprint_approval,
            approval_statuses=approval_statuses,
            review_statuses=review_statuses,
        )


        update_project_agent_settings.additional_properties = d
        return update_project_agent_settings

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
