from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_approval_status import IssueApprovalStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.issue_approval_issue import IssueApprovalIssue
  from ..models.issue_approval_to_status import IssueApprovalToStatus
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="IssueApproval")



@_attrs_define
class IssueApproval:
    """ 
        Attributes:
            id (UUID):
            issue (IssueApprovalIssue):
            project_key (str):
            to_status (IssueApprovalToStatus):
            requested_by (UserRef):
            status (IssueApprovalStatus):
            decided_by (None | UserRef):
            reason (str):
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
     """

    id: UUID
    issue: IssueApprovalIssue
    project_key: str
    to_status: IssueApprovalToStatus
    requested_by: UserRef
    status: IssueApprovalStatus
    decided_by: None | UserRef
    reason: str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_approval_issue import IssueApprovalIssue # noqa: PLC0415
        from ..models.issue_approval_to_status import IssueApprovalToStatus # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        issue = self.issue.to_dict()

        project_key = self.project_key

        to_status = self.to_status.to_dict()

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
            "issue": issue,
            "projectKey": project_key,
            "toStatus": to_status,
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
        from ..models.issue_approval_issue import IssueApprovalIssue # noqa: PLC0415
        from ..models.issue_approval_to_status import IssueApprovalToStatus # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        issue = IssueApprovalIssue.from_dict(d.pop("issue"))




        project_key = d.pop("projectKey")

        to_status = IssueApprovalToStatus.from_dict(d.pop("toStatus"))




        requested_by = UserRef.from_dict(d.pop("requestedBy"))




        status = IssueApprovalStatus(d.pop("status"))




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


        issue_approval = cls(
            id=id,
            issue=issue,
            project_key=project_key,
            to_status=to_status,
            requested_by=requested_by,
            status=status,
            decided_by=decided_by,
            reason=reason,
            created_at=created_at,
            decided_at=decided_at,
        )

        return issue_approval

