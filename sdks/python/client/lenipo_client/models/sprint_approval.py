from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sprint_approval_action import SprintApprovalAction
from ..models.sprint_approval_status import SprintApprovalStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.sprint_approval_sprint import SprintApprovalSprint
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="SprintApproval")



@_attrs_define
class SprintApproval:
    """ 
        Attributes:
            id (UUID):
            action (SprintApprovalAction):
            sprint (SprintApprovalSprint):
            project_key (str):
            requested_by (UserRef):
            status (SprintApprovalStatus):
            decided_by (None | UserRef):
            reason (str):
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
     """

    id: UUID
    action: SprintApprovalAction
    sprint: SprintApprovalSprint
    project_key: str
    requested_by: UserRef
    status: SprintApprovalStatus
    decided_by: None | UserRef
    reason: str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.sprint_approval_sprint import SprintApprovalSprint # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        action = self.action.value

        sprint = self.sprint.to_dict()

        project_key = self.project_key

        requested_by = self.requested_by.to_dict()

        status = self.status.value

        decided_by: dict[str, Any] | None
        if isinstance(self.decided_by, UserRef):
            decided_by = self.decided_by.to_dict()
        else:
            decided_by = self.decided_by

        reason = self.reason

        created_at = self.created_at.isoformat()

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "action": action,
            "sprint": sprint,
            "projectKey": project_key,
            "requestedBy": requested_by,
            "status": status,
            "decidedBy": decided_by,
            "reason": reason,
            "createdAt": created_at,
            "decidedAt": decided_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sprint_approval_sprint import SprintApprovalSprint # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        action = SprintApprovalAction(d.pop("action"))




        sprint = SprintApprovalSprint.from_dict(d.pop("sprint"))




        project_key = d.pop("projectKey")

        requested_by = UserRef.from_dict(d.pop("requestedBy"))




        status = SprintApprovalStatus(d.pop("status"))




        def _parse_decided_by(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                decided_by_type_0 = UserRef.from_dict(data)



                return decided_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        decided_by = _parse_decided_by(d.pop("decidedBy"))


        reason = d.pop("reason")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_decided_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                decided_at_type_0 = datetime.datetime.fromisoformat(data)



                return decided_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        decided_at = _parse_decided_at(d.pop("decidedAt"))


        sprint_approval = cls(
            id=id,
            action=action,
            sprint=sprint,
            project_key=project_key,
            requested_by=requested_by,
            status=status,
            decided_by=decided_by,
            reason=reason,
            created_at=created_at,
            decided_at=decided_at,
        )

        return sprint_approval

