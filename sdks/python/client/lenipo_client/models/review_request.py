from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.review_status import ReviewStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.review_request_issue import ReviewRequestIssue
  from ..models.review_request_pull_request_type_0 import ReviewRequestPullRequestType0
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ReviewRequest")



@_attrs_define
class ReviewRequest:
    """ 
        Attributes:
            id (UUID):
            issue (ReviewRequestIssue):
            requester (UserRef):
            reviewer (UserRef):
            status (ReviewStatus):
            verdict (str):
            pull_request (None | ReviewRequestPullRequestType0):
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
     """

    id: UUID
    issue: ReviewRequestIssue
    requester: UserRef
    reviewer: UserRef
    status: ReviewStatus
    verdict: str
    pull_request: None | ReviewRequestPullRequestType0
    created_at: datetime.datetime
    decided_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.review_request_issue import ReviewRequestIssue # noqa: PLC0415
        from ..models.review_request_pull_request_type_0 import ReviewRequestPullRequestType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        issue = self.issue.to_dict()

        requester = self.requester.to_dict()

        reviewer = self.reviewer.to_dict()

        status = self.status.value

        verdict = self.verdict

        pull_request: dict[str, Any] | None
        if isinstance(self.pull_request, ReviewRequestPullRequestType0):
            pull_request = self.pull_request.to_dict()
        else:
            pull_request = self.pull_request

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
            "requester": requester,
            "reviewer": reviewer,
            "status": status,
            "verdict": verdict,
            "pullRequest": pull_request,
            "createdAt": created_at,
            "decidedAt": decided_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.review_request_issue import ReviewRequestIssue # noqa: PLC0415
        from ..models.review_request_pull_request_type_0 import ReviewRequestPullRequestType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        issue = ReviewRequestIssue.from_dict(d.pop("issue"))




        requester = UserRef.from_dict(d.pop("requester"))




        reviewer = UserRef.from_dict(d.pop("reviewer"))




        status = ReviewStatus(d.pop("status"))




        verdict = d.pop("verdict")

        def _parse_pull_request(data: object) -> None | ReviewRequestPullRequestType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                pull_request_type_0 = ReviewRequestPullRequestType0.from_dict(data)



                return pull_request_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ReviewRequestPullRequestType0, data)

        pull_request = _parse_pull_request(d.pop("pullRequest"))


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


        review_request = cls(
            id=id,
            issue=issue,
            requester=requester,
            reviewer=reviewer,
            status=status,
            verdict=verdict,
            pull_request=pull_request,
            created_at=created_at,
            decided_at=decided_at,
        )

        return review_request

