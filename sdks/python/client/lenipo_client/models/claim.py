from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.claim_issue import ClaimIssue
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Claim")



@_attrs_define
class Claim:
    """ 
        Attributes:
            issue (ClaimIssue):
            user (UserRef):
            branch (None | str):
            paths (list[str]):
            forced (bool):
            claimed_at (datetime.datetime):
            expires_at (datetime.datetime):
     """

    issue: ClaimIssue
    user: UserRef
    branch: None | str
    paths: list[str]
    forced: bool
    claimed_at: datetime.datetime
    expires_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.claim_issue import ClaimIssue # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        issue = self.issue.to_dict()

        user = self.user.to_dict()

        branch: None | str
        branch = self.branch

        paths = self.paths



        forced = self.forced

        claimed_at = self.claimed_at.isoformat()

        expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "user": user,
            "branch": branch,
            "paths": paths,
            "forced": forced,
            "claimedAt": claimed_at,
            "expiresAt": expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.claim_issue import ClaimIssue # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        issue = ClaimIssue.from_dict(d.pop("issue"))




        user = UserRef.from_dict(d.pop("user"))




        def _parse_branch(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        branch = _parse_branch(d.pop("branch"))


        paths = cast(list[str], d.pop("paths"))


        forced = d.pop("forced")

        claimed_at = datetime.datetime.fromisoformat(d.pop("claimedAt"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))




        claim = cls(
            issue=issue,
            user=user,
            branch=branch,
            paths=paths,
            forced=forced,
            claimed_at=claimed_at,
            expires_at=expires_at,
        )

        return claim

