from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_development_commits_latest_item import IssueDevelopmentCommitsLatestItem





T = TypeVar("T", bound="IssueDevelopmentCommits")



@_attrs_define
class IssueDevelopmentCommits:
    """ 
        Attributes:
            count (int):
            latest (list[IssueDevelopmentCommitsLatestItem]):
     """

    count: int
    latest: list[IssueDevelopmentCommitsLatestItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_development_commits_latest_item import IssueDevelopmentCommitsLatestItem # noqa: PLC0415
        count = self.count

        latest = []
        for latest_item_data in self.latest:
            latest_item = latest_item_data.to_dict()
            latest.append(latest_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "count": count,
            "latest": latest,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_development_commits_latest_item import IssueDevelopmentCommitsLatestItem # noqa: PLC0415
        d = dict(src_dict)
        count = d.pop("count")

        latest = []
        _latest = d.pop("latest")
        for latest_item_data in (_latest):
            latest_item = IssueDevelopmentCommitsLatestItem.from_dict(latest_item_data)



            latest.append(latest_item)


        issue_development_commits = cls(
            count=count,
            latest=latest,
        )

        return issue_development_commits

