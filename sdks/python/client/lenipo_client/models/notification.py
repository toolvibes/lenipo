from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.notification_category import NotificationCategory
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.notification_details import NotificationDetails
  from ..models.notification_issue_type_0 import NotificationIssueType0
  from ..models.notification_page_type_0 import NotificationPageType0
  from ..models.notification_sprint_type_0 import NotificationSprintType0
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Notification")



@_attrs_define
class Notification:
    """ 
        Attributes:
            id (int):
            issue (None | NotificationIssueType0):
            page (None | NotificationPageType0):
            sprint (None | NotificationSprintType0):
            agent (None | UserRef):
            actor (None | UserRef):
            category (NotificationCategory):
            details (NotificationDetails):
            created_at (datetime.datetime):
            read (bool):
     """

    id: int
    issue: None | NotificationIssueType0
    page: None | NotificationPageType0
    sprint: None | NotificationSprintType0
    agent: None | UserRef
    actor: None | UserRef
    category: NotificationCategory
    details: NotificationDetails
    created_at: datetime.datetime
    read: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.notification_details import NotificationDetails # noqa: PLC0415
        from ..models.notification_issue_type_0 import NotificationIssueType0 # noqa: PLC0415
        from ..models.notification_page_type_0 import NotificationPageType0 # noqa: PLC0415
        from ..models.notification_sprint_type_0 import NotificationSprintType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = self.id

        issue: dict[str, Any] | None
        if isinstance(self.issue, NotificationIssueType0):
            issue = self.issue.to_dict()
        else:
            issue = self.issue

        page: dict[str, Any] | None
        if isinstance(self.page, NotificationPageType0):
            page = self.page.to_dict()
        else:
            page = self.page

        sprint: dict[str, Any] | None
        if isinstance(self.sprint, NotificationSprintType0):
            sprint = self.sprint.to_dict()
        else:
            sprint = self.sprint

        agent: dict[str, Any] | None
        if isinstance(self.agent, UserRef):
            agent = self.agent.to_dict()
        else:
            agent = self.agent

        actor: dict[str, Any] | None
        if isinstance(self.actor, UserRef):
            actor = self.actor.to_dict()
        else:
            actor = self.actor

        category = self.category.value

        details = self.details.to_dict()

        created_at = self.created_at.isoformat()

        read = self.read


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "issue": issue,
            "page": page,
            "sprint": sprint,
            "agent": agent,
            "actor": actor,
            "category": category,
            "details": details,
            "createdAt": created_at,
            "read": read,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification_details import NotificationDetails # noqa: PLC0415
        from ..models.notification_issue_type_0 import NotificationIssueType0 # noqa: PLC0415
        from ..models.notification_page_type_0 import NotificationPageType0 # noqa: PLC0415
        from ..models.notification_sprint_type_0 import NotificationSprintType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        def _parse_issue(data: object) -> None | NotificationIssueType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                issue_type_0 = NotificationIssueType0.from_dict(data)



                return issue_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | NotificationIssueType0, data)

        issue = _parse_issue(d.pop("issue"))


        def _parse_page(data: object) -> None | NotificationPageType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                page_type_0 = NotificationPageType0.from_dict(data)



                return page_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | NotificationPageType0, data)

        page = _parse_page(d.pop("page"))


        def _parse_sprint(data: object) -> None | NotificationSprintType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sprint_type_0 = NotificationSprintType0.from_dict(data)



                return sprint_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | NotificationSprintType0, data)

        sprint = _parse_sprint(d.pop("sprint"))


        def _parse_agent(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                agent_type_0 = UserRef.from_dict(data)



                return agent_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        agent = _parse_agent(d.pop("agent"))


        def _parse_actor(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                actor_type_0 = UserRef.from_dict(data)



                return actor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        actor = _parse_actor(d.pop("actor"))


        category = NotificationCategory(d.pop("category"))




        details = NotificationDetails.from_dict(d.pop("details"))




        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        read = d.pop("read")

        notification = cls(
            id=id,
            issue=issue,
            page=page,
            sprint=sprint,
            agent=agent,
            actor=actor,
            category=category,
            details=details,
            created_at=created_at,
            read=read,
        )

        return notification

