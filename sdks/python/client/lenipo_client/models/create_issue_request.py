from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.create_issue_request_custom_fields import CreateIssueRequestCustomFields
  from ..models.rich_text import RichText
  from ..models.rich_text_input_type_1 import RichTextInputType1





T = TypeVar("T", bound="CreateIssueRequest")



@_attrs_define
class CreateIssueRequest:
    """ 
        Attributes:
            project_key (str):
            issue_type (str):
            summary (str):
            security_level_id (None | Unset | UUID):
            description (None | RichText | RichTextInputType1 | Unset):
            priority (str | Unset):
            assignee_id (None | Unset | UUID):
            parent_key (None | str | Unset):
            labels (list[str] | Unset):
            story_points (float | None | Unset):
            start_date (datetime.date | None | Unset):
            due_date (datetime.date | None | Unset):
            components (list[str] | Unset):
            fix_versions (list[str] | Unset):
            affects_versions (list[str] | Unset):
            custom_fields (CreateIssueRequestCustomFields | Unset):
     """

    project_key: str
    issue_type: str
    summary: str
    security_level_id: None | Unset | UUID = UNSET
    description: None | RichText | RichTextInputType1 | Unset = UNSET
    priority: str | Unset = UNSET
    assignee_id: None | Unset | UUID = UNSET
    parent_key: None | str | Unset = UNSET
    labels: list[str] | Unset = UNSET
    story_points: float | None | Unset = UNSET
    start_date: datetime.date | None | Unset = UNSET
    due_date: datetime.date | None | Unset = UNSET
    components: list[str] | Unset = UNSET
    fix_versions: list[str] | Unset = UNSET
    affects_versions: list[str] | Unset = UNSET
    custom_fields: CreateIssueRequestCustomFields | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_issue_request_custom_fields import CreateIssueRequestCustomFields # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        project_key = self.project_key

        issue_type = self.issue_type

        summary = self.summary

        security_level_id: None | str | Unset
        if isinstance(self.security_level_id, Unset):
            security_level_id = UNSET
        elif isinstance(self.security_level_id, UUID):
            security_level_id = str(self.security_level_id)
        else:
            security_level_id = self.security_level_id

        description: dict[str, Any] | None | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        elif isinstance(self.description, RichText):
            description = self.description.to_dict()
        elif isinstance(self.description, RichTextInputType1):
            description = self.description.to_dict()
        else:
            description = self.description

        priority = self.priority

        assignee_id: None | str | Unset
        if isinstance(self.assignee_id, Unset):
            assignee_id = UNSET
        elif isinstance(self.assignee_id, UUID):
            assignee_id = str(self.assignee_id)
        else:
            assignee_id = self.assignee_id

        parent_key: None | str | Unset
        if isinstance(self.parent_key, Unset):
            parent_key = UNSET
        else:
            parent_key = self.parent_key

        labels: list[str] | Unset = UNSET
        if not isinstance(self.labels, Unset):
            labels = self.labels



        story_points: float | None | Unset
        if isinstance(self.story_points, Unset):
            story_points = UNSET
        else:
            story_points = self.story_points

        start_date: None | str | Unset
        if isinstance(self.start_date, Unset):
            start_date = UNSET
        elif isinstance(self.start_date, datetime.date):
            start_date = self.start_date.isoformat()
        else:
            start_date = self.start_date

        due_date: None | str | Unset
        if isinstance(self.due_date, Unset):
            due_date = UNSET
        elif isinstance(self.due_date, datetime.date):
            due_date = self.due_date.isoformat()
        else:
            due_date = self.due_date

        components: list[str] | Unset = UNSET
        if not isinstance(self.components, Unset):
            components = self.components



        fix_versions: list[str] | Unset = UNSET
        if not isinstance(self.fix_versions, Unset):
            fix_versions = self.fix_versions



        affects_versions: list[str] | Unset = UNSET
        if not isinstance(self.affects_versions, Unset):
            affects_versions = self.affects_versions



        custom_fields: dict[str, Any] | Unset = UNSET
        if not isinstance(self.custom_fields, Unset):
            custom_fields = self.custom_fields.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "projectKey": project_key,
            "issueType": issue_type,
            "summary": summary,
        })
        if security_level_id is not UNSET:
            field_dict["securityLevelId"] = security_level_id
        if description is not UNSET:
            field_dict["description"] = description
        if priority is not UNSET:
            field_dict["priority"] = priority
        if assignee_id is not UNSET:
            field_dict["assigneeId"] = assignee_id
        if parent_key is not UNSET:
            field_dict["parentKey"] = parent_key
        if labels is not UNSET:
            field_dict["labels"] = labels
        if story_points is not UNSET:
            field_dict["storyPoints"] = story_points
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if due_date is not UNSET:
            field_dict["dueDate"] = due_date
        if components is not UNSET:
            field_dict["components"] = components
        if fix_versions is not UNSET:
            field_dict["fixVersions"] = fix_versions
        if affects_versions is not UNSET:
            field_dict["affectsVersions"] = affects_versions
        if custom_fields is not UNSET:
            field_dict["customFields"] = custom_fields

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_issue_request_custom_fields import CreateIssueRequestCustomFields # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        d = dict(src_dict)
        project_key = d.pop("projectKey")

        issue_type = d.pop("issueType")

        summary = d.pop("summary")

        def _parse_security_level_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                security_level_id_type_0 = UUID(data)



                return security_level_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        security_level_id = _parse_security_level_id(d.pop("securityLevelId", UNSET))


        def _parse_description(data: object) -> None | RichText | RichTextInputType1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_input_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_input_type_1 = RichTextInputType1.from_dict(data)



                return componentsschemas_rich_text_input_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RichText | RichTextInputType1 | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        priority = d.pop("priority", UNSET)

        def _parse_assignee_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                assignee_id_type_0 = UUID(data)



                return assignee_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        assignee_id = _parse_assignee_id(d.pop("assigneeId", UNSET))


        def _parse_parent_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        parent_key = _parse_parent_key(d.pop("parentKey", UNSET))


        labels = cast(list[str], d.pop("labels", UNSET))


        def _parse_story_points(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        story_points = _parse_story_points(d.pop("storyPoints", UNSET))


        def _parse_start_date(data: object) -> datetime.date | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                start_date_type_0 = datetime.date.fromisoformat(data)



                return start_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None | Unset, data)

        start_date = _parse_start_date(d.pop("startDate", UNSET))


        def _parse_due_date(data: object) -> datetime.date | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                due_date_type_0 = datetime.date.fromisoformat(data)



                return due_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None | Unset, data)

        due_date = _parse_due_date(d.pop("dueDate", UNSET))


        components = cast(list[str], d.pop("components", UNSET))


        fix_versions = cast(list[str], d.pop("fixVersions", UNSET))


        affects_versions = cast(list[str], d.pop("affectsVersions", UNSET))


        _custom_fields = d.pop("customFields", UNSET)
        custom_fields: CreateIssueRequestCustomFields | Unset
        if isinstance(_custom_fields,  Unset):
            custom_fields = UNSET
        else:
            custom_fields = CreateIssueRequestCustomFields.from_dict(_custom_fields)




        create_issue_request = cls(
            project_key=project_key,
            issue_type=issue_type,
            summary=summary,
            security_level_id=security_level_id,
            description=description,
            priority=priority,
            assignee_id=assignee_id,
            parent_key=parent_key,
            labels=labels,
            story_points=story_points,
            start_date=start_date,
            due_date=due_date,
            components=components,
            fix_versions=fix_versions,
            affects_versions=affects_versions,
            custom_fields=custom_fields,
        )


        create_issue_request.additional_properties = d
        return create_issue_request

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
