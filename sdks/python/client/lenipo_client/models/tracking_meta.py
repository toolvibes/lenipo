from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.custom_field import CustomField
  from ..models.issue_link_type_info import IssueLinkTypeInfo
  from ..models.issue_type_info import IssueTypeInfo
  from ..models.priority_info import PriorityInfo
  from ..models.resolution_info import ResolutionInfo
  from ..models.status_info import StatusInfo
  from ..models.working_time import WorkingTime





T = TypeVar("T", bound="TrackingMeta")



@_attrs_define
class TrackingMeta:
    """ 
        Attributes:
            issue_types (list[IssueTypeInfo]):
            statuses (list[StatusInfo]):
            priorities (list[PriorityInfo]):
            resolutions (list[ResolutionInfo]):
            link_types (list[IssueLinkTypeInfo]):
            attachment_max_bytes (int):
            working_time (WorkingTime):
            custom_fields (list[CustomField]):
     """

    issue_types: list[IssueTypeInfo]
    statuses: list[StatusInfo]
    priorities: list[PriorityInfo]
    resolutions: list[ResolutionInfo]
    link_types: list[IssueLinkTypeInfo]
    attachment_max_bytes: int
    working_time: WorkingTime
    custom_fields: list[CustomField]





    def to_dict(self) -> dict[str, Any]:
        from ..models.custom_field import CustomField # noqa: PLC0415
        from ..models.issue_link_type_info import IssueLinkTypeInfo # noqa: PLC0415
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.priority_info import PriorityInfo # noqa: PLC0415
        from ..models.resolution_info import ResolutionInfo # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.working_time import WorkingTime # noqa: PLC0415
        issue_types = []
        for issue_types_item_data in self.issue_types:
            issue_types_item = issue_types_item_data.to_dict()
            issue_types.append(issue_types_item)



        statuses = []
        for statuses_item_data in self.statuses:
            statuses_item = statuses_item_data.to_dict()
            statuses.append(statuses_item)



        priorities = []
        for priorities_item_data in self.priorities:
            priorities_item = priorities_item_data.to_dict()
            priorities.append(priorities_item)



        resolutions = []
        for resolutions_item_data in self.resolutions:
            resolutions_item = resolutions_item_data.to_dict()
            resolutions.append(resolutions_item)



        link_types = []
        for link_types_item_data in self.link_types:
            link_types_item = link_types_item_data.to_dict()
            link_types.append(link_types_item)



        attachment_max_bytes = self.attachment_max_bytes

        working_time = self.working_time.to_dict()

        custom_fields = []
        for custom_fields_item_data in self.custom_fields:
            custom_fields_item = custom_fields_item_data.to_dict()
            custom_fields.append(custom_fields_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issueTypes": issue_types,
            "statuses": statuses,
            "priorities": priorities,
            "resolutions": resolutions,
            "linkTypes": link_types,
            "attachmentMaxBytes": attachment_max_bytes,
            "workingTime": working_time,
            "customFields": custom_fields,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.custom_field import CustomField # noqa: PLC0415
        from ..models.issue_link_type_info import IssueLinkTypeInfo # noqa: PLC0415
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.priority_info import PriorityInfo # noqa: PLC0415
        from ..models.resolution_info import ResolutionInfo # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.working_time import WorkingTime # noqa: PLC0415
        d = dict(src_dict)
        issue_types = []
        _issue_types = d.pop("issueTypes")
        for issue_types_item_data in (_issue_types):
            issue_types_item = IssueTypeInfo.from_dict(issue_types_item_data)



            issue_types.append(issue_types_item)


        statuses = []
        _statuses = d.pop("statuses")
        for statuses_item_data in (_statuses):
            statuses_item = StatusInfo.from_dict(statuses_item_data)



            statuses.append(statuses_item)


        priorities = []
        _priorities = d.pop("priorities")
        for priorities_item_data in (_priorities):
            priorities_item = PriorityInfo.from_dict(priorities_item_data)



            priorities.append(priorities_item)


        resolutions = []
        _resolutions = d.pop("resolutions")
        for resolutions_item_data in (_resolutions):
            resolutions_item = ResolutionInfo.from_dict(resolutions_item_data)



            resolutions.append(resolutions_item)


        link_types = []
        _link_types = d.pop("linkTypes")
        for link_types_item_data in (_link_types):
            link_types_item = IssueLinkTypeInfo.from_dict(link_types_item_data)



            link_types.append(link_types_item)


        attachment_max_bytes = d.pop("attachmentMaxBytes")

        working_time = WorkingTime.from_dict(d.pop("workingTime"))




        custom_fields = []
        _custom_fields = d.pop("customFields")
        for custom_fields_item_data in (_custom_fields):
            custom_fields_item = CustomField.from_dict(custom_fields_item_data)



            custom_fields.append(custom_fields_item)


        tracking_meta = cls(
            issue_types=issue_types,
            statuses=statuses,
            priorities=priorities,
            resolutions=resolutions,
            link_types=link_types,
            attachment_max_bytes=attachment_max_bytes,
            working_time=working_time,
            custom_fields=custom_fields,
        )

        return tracking_meta

