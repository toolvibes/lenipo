from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.component_ref import ComponentRef
  from ..models.issue_custom_fields import IssueCustomFields
  from ..models.issue_link import IssueLink
  from ..models.issue_project import IssueProject
  from ..models.issue_ref import IssueRef
  from ..models.issue_security_level_type_0 import IssueSecurityLevelType0
  from ..models.issue_summary import IssueSummary
  from ..models.issue_type_info import IssueTypeInfo
  from ..models.priority_info import PriorityInfo
  from ..models.resolution_info import ResolutionInfo
  from ..models.rich_text import RichText
  from ..models.sprint_ref import SprintRef
  from ..models.status_info import StatusInfo
  from ..models.time_tracking import TimeTracking
  from ..models.user_ref import UserRef
  from ..models.version_ref import VersionRef





T = TypeVar("T", bound="Issue")



@_attrs_define
class Issue:
    """ 
        Attributes:
            id (UUID):
            key (str):
            project (IssueProject):
            summary (str):
            issue_type (IssueTypeInfo):
            status (StatusInfo):
            priority (PriorityInfo):
            assignee (None | UserRef):
            story_points (float | None):
            labels (list[str]):
            rank (str):
            updated_at (datetime.datetime):
            reporter (None | UserRef):
            resolution (None | ResolutionInfo):
            start_date (datetime.date | None):
            due_date (datetime.date | None):
            created_at (datetime.datetime):
            resolved_at (datetime.datetime | None):
            components (list[ComponentRef]):
            time_tracking (TimeTracking):
            custom_fields (IssueCustomFields):
            parent (IssueRef | None):
            sprint (None | SprintRef):
            fix_versions (list[VersionRef]):
            affects_versions (list[VersionRef]):
            can_edit (bool):
            can_assign (bool):
            can_transition (bool):
            security_level (IssueSecurityLevelType0 | None):
            description (None | RichText | str):
            children (list[IssueSummary]):
            watching (bool):
            watcher_count (int):
            links (list[IssueLink]):
     """

    id: UUID
    key: str
    project: IssueProject
    summary: str
    issue_type: IssueTypeInfo
    status: StatusInfo
    priority: PriorityInfo
    assignee: None | UserRef
    story_points: float | None
    labels: list[str]
    rank: str
    updated_at: datetime.datetime
    reporter: None | UserRef
    resolution: None | ResolutionInfo
    start_date: datetime.date | None
    due_date: datetime.date | None
    created_at: datetime.datetime
    resolved_at: datetime.datetime | None
    components: list[ComponentRef]
    time_tracking: TimeTracking
    custom_fields: IssueCustomFields
    parent: IssueRef | None
    sprint: None | SprintRef
    fix_versions: list[VersionRef]
    affects_versions: list[VersionRef]
    can_edit: bool
    can_assign: bool
    can_transition: bool
    security_level: IssueSecurityLevelType0 | None
    description: None | RichText | str
    children: list[IssueSummary]
    watching: bool
    watcher_count: int
    links: list[IssueLink]





    def to_dict(self) -> dict[str, Any]:
        from ..models.component_ref import ComponentRef # noqa: PLC0415
        from ..models.issue_custom_fields import IssueCustomFields # noqa: PLC0415
        from ..models.issue_link import IssueLink # noqa: PLC0415
        from ..models.issue_project import IssueProject # noqa: PLC0415
        from ..models.issue_ref import IssueRef # noqa: PLC0415
        from ..models.issue_security_level_type_0 import IssueSecurityLevelType0 # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.priority_info import PriorityInfo # noqa: PLC0415
        from ..models.resolution_info import ResolutionInfo # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.sprint_ref import SprintRef # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.time_tracking import TimeTracking # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        from ..models.version_ref import VersionRef # noqa: PLC0415
        id = str(self.id)

        key = self.key

        project = self.project.to_dict()

        summary = self.summary

        issue_type = self.issue_type.to_dict()

        status = self.status.to_dict()

        priority = self.priority.to_dict()

        assignee: dict[str, Any] | None
        if isinstance(self.assignee, UserRef):
            assignee = self.assignee.to_dict()
        else:
            assignee = self.assignee

        story_points: float | None
        story_points = self.story_points

        labels = self.labels



        rank = self.rank

        updated_at = self.updated_at.isoformat()

        reporter: dict[str, Any] | None
        if isinstance(self.reporter, UserRef):
            reporter = self.reporter.to_dict()
        else:
            reporter = self.reporter

        resolution: dict[str, Any] | None
        if isinstance(self.resolution, ResolutionInfo):
            resolution = self.resolution.to_dict()
        else:
            resolution = self.resolution

        start_date: None | str
        if isinstance(self.start_date, datetime.date):
            start_date = self.start_date.isoformat()
        else:
            start_date = self.start_date

        due_date: None | str
        if isinstance(self.due_date, datetime.date):
            due_date = self.due_date.isoformat()
        else:
            due_date = self.due_date

        created_at = self.created_at.isoformat()

        resolved_at: None | str
        if isinstance(self.resolved_at, datetime.datetime):
            resolved_at = self.resolved_at.isoformat()
        else:
            resolved_at = self.resolved_at

        components = []
        for components_item_data in self.components:
            components_item = components_item_data.to_dict()
            components.append(components_item)



        time_tracking = self.time_tracking.to_dict()

        custom_fields = self.custom_fields.to_dict()

        parent: dict[str, Any] | None
        if isinstance(self.parent, IssueRef):
            parent = self.parent.to_dict()
        else:
            parent = self.parent

        sprint: dict[str, Any] | None
        if isinstance(self.sprint, SprintRef):
            sprint = self.sprint.to_dict()
        else:
            sprint = self.sprint

        fix_versions = []
        for fix_versions_item_data in self.fix_versions:
            fix_versions_item = fix_versions_item_data.to_dict()
            fix_versions.append(fix_versions_item)



        affects_versions = []
        for affects_versions_item_data in self.affects_versions:
            affects_versions_item = affects_versions_item_data.to_dict()
            affects_versions.append(affects_versions_item)



        can_edit = self.can_edit

        can_assign = self.can_assign

        can_transition = self.can_transition

        security_level: dict[str, Any] | None
        if isinstance(self.security_level, IssueSecurityLevelType0):
            security_level = self.security_level.to_dict()
        else:
            security_level = self.security_level

        description: dict[str, Any] | None | str
        if isinstance(self.description, RichText):
            description = self.description.to_dict()
        else:
            description = self.description

        children = []
        for children_item_data in self.children:
            children_item = children_item_data.to_dict()
            children.append(children_item)



        watching = self.watching

        watcher_count = self.watcher_count

        links = []
        for links_item_data in self.links:
            links_item = links_item_data.to_dict()
            links.append(links_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "project": project,
            "summary": summary,
            "issueType": issue_type,
            "status": status,
            "priority": priority,
            "assignee": assignee,
            "storyPoints": story_points,
            "labels": labels,
            "rank": rank,
            "updatedAt": updated_at,
            "reporter": reporter,
            "resolution": resolution,
            "startDate": start_date,
            "dueDate": due_date,
            "createdAt": created_at,
            "resolvedAt": resolved_at,
            "components": components,
            "timeTracking": time_tracking,
            "customFields": custom_fields,
            "parent": parent,
            "sprint": sprint,
            "fixVersions": fix_versions,
            "affectsVersions": affects_versions,
            "canEdit": can_edit,
            "canAssign": can_assign,
            "canTransition": can_transition,
            "securityLevel": security_level,
            "description": description,
            "children": children,
            "watching": watching,
            "watcherCount": watcher_count,
            "links": links,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.component_ref import ComponentRef # noqa: PLC0415
        from ..models.issue_custom_fields import IssueCustomFields # noqa: PLC0415
        from ..models.issue_link import IssueLink # noqa: PLC0415
        from ..models.issue_project import IssueProject # noqa: PLC0415
        from ..models.issue_ref import IssueRef # noqa: PLC0415
        from ..models.issue_security_level_type_0 import IssueSecurityLevelType0 # noqa: PLC0415
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.issue_type_info import IssueTypeInfo # noqa: PLC0415
        from ..models.priority_info import PriorityInfo # noqa: PLC0415
        from ..models.resolution_info import ResolutionInfo # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.sprint_ref import SprintRef # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        from ..models.time_tracking import TimeTracking # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        from ..models.version_ref import VersionRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        project = IssueProject.from_dict(d.pop("project"))




        summary = d.pop("summary")

        issue_type = IssueTypeInfo.from_dict(d.pop("issueType"))




        status = StatusInfo.from_dict(d.pop("status"))




        priority = PriorityInfo.from_dict(d.pop("priority"))




        def _parse_assignee(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                assignee_type_0 = UserRef.from_dict(data)



                return assignee_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        assignee = _parse_assignee(d.pop("assignee"))


        def _parse_story_points(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        story_points = _parse_story_points(d.pop("storyPoints"))


        labels = cast(list[str], d.pop("labels"))


        rank = d.pop("rank")

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        def _parse_reporter(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                reporter_type_0 = UserRef.from_dict(data)



                return reporter_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        reporter = _parse_reporter(d.pop("reporter"))


        def _parse_resolution(data: object) -> None | ResolutionInfo:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resolution_type_0 = ResolutionInfo.from_dict(data)



                return resolution_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ResolutionInfo, data)

        resolution = _parse_resolution(d.pop("resolution"))


        def _parse_start_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                start_date_type_0 = datetime.date.fromisoformat(data)



                return start_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        start_date = _parse_start_date(d.pop("startDate"))


        def _parse_due_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                due_date_type_0 = datetime.date.fromisoformat(data)



                return due_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        due_date = _parse_due_date(d.pop("dueDate"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_resolved_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                resolved_at_type_0 = datetime.datetime.fromisoformat(data)



                return resolved_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        resolved_at = _parse_resolved_at(d.pop("resolvedAt"))


        components = []
        _components = d.pop("components")
        for components_item_data in (_components):
            components_item = ComponentRef.from_dict(components_item_data)



            components.append(components_item)


        time_tracking = TimeTracking.from_dict(d.pop("timeTracking"))




        custom_fields = IssueCustomFields.from_dict(d.pop("customFields"))




        def _parse_parent(data: object) -> IssueRef | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                parent_type_0 = IssueRef.from_dict(data)



                return parent_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(IssueRef | None, data)

        parent = _parse_parent(d.pop("parent"))


        def _parse_sprint(data: object) -> None | SprintRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sprint_type_0 = SprintRef.from_dict(data)



                return sprint_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SprintRef, data)

        sprint = _parse_sprint(d.pop("sprint"))


        fix_versions = []
        _fix_versions = d.pop("fixVersions")
        for fix_versions_item_data in (_fix_versions):
            fix_versions_item = VersionRef.from_dict(fix_versions_item_data)



            fix_versions.append(fix_versions_item)


        affects_versions = []
        _affects_versions = d.pop("affectsVersions")
        for affects_versions_item_data in (_affects_versions):
            affects_versions_item = VersionRef.from_dict(affects_versions_item_data)



            affects_versions.append(affects_versions_item)


        can_edit = d.pop("canEdit")

        can_assign = d.pop("canAssign")

        can_transition = d.pop("canTransition")

        def _parse_security_level(data: object) -> IssueSecurityLevelType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                security_level_type_0 = IssueSecurityLevelType0.from_dict(data)



                return security_level_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(IssueSecurityLevelType0 | None, data)

        security_level = _parse_security_level(d.pop("securityLevel"))


        def _parse_description(data: object) -> None | RichText | str:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_output_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_output_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RichText | str, data)

        description = _parse_description(d.pop("description"))


        children = []
        _children = d.pop("children")
        for children_item_data in (_children):
            children_item = IssueSummary.from_dict(children_item_data)



            children.append(children_item)


        watching = d.pop("watching")

        watcher_count = d.pop("watcherCount")

        links = []
        _links = d.pop("links")
        for links_item_data in (_links):
            links_item = IssueLink.from_dict(links_item_data)



            links.append(links_item)


        issue = cls(
            id=id,
            key=key,
            project=project,
            summary=summary,
            issue_type=issue_type,
            status=status,
            priority=priority,
            assignee=assignee,
            story_points=story_points,
            labels=labels,
            rank=rank,
            updated_at=updated_at,
            reporter=reporter,
            resolution=resolution,
            start_date=start_date,
            due_date=due_date,
            created_at=created_at,
            resolved_at=resolved_at,
            components=components,
            time_tracking=time_tracking,
            custom_fields=custom_fields,
            parent=parent,
            sprint=sprint,
            fix_versions=fix_versions,
            affects_versions=affects_versions,
            can_edit=can_edit,
            can_assign=can_assign,
            can_transition=can_transition,
            security_level=security_level,
            description=description,
            children=children,
            watching=watching,
            watcher_count=watcher_count,
            links=links,
        )

        return issue

