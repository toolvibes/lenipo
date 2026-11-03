from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.claim_conflict_user import ClaimConflictUser





T = TypeVar("T", bound="ClaimConflict")



@_attrs_define
class ClaimConflict:
    """ 
        Attributes:
            issue_key (str):
            user (ClaimConflictUser):
            branch (None | str):
            paths (list[str]):
     """

    issue_key: str
    user: ClaimConflictUser
    branch: None | str
    paths: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.claim_conflict_user import ClaimConflictUser # noqa: PLC0415
        issue_key = self.issue_key

        user = self.user.to_dict()

        branch: None | str
        branch = self.branch

        paths = self.paths




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issueKey": issue_key,
            "user": user,
            "branch": branch,
            "paths": paths,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.claim_conflict_user import ClaimConflictUser # noqa: PLC0415
        d = dict(src_dict)
        issue_key = d.pop("issueKey")

        user = ClaimConflictUser.from_dict(d.pop("user"))




        def _parse_branch(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        branch = _parse_branch(d.pop("branch"))


        paths = cast(list[str], d.pop("paths"))


        claim_conflict = cls(
            issue_key=issue_key,
            user=user,
            branch=branch,
            paths=paths,
        )

        return claim_conflict

