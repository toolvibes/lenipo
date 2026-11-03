from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="IssueDevelopmentCommitsLatestItem")



@_attrs_define
class IssueDevelopmentCommitsLatestItem:
    """ 
        Attributes:
            sha (str):
            message (str):
            repository (str):
            url (None | str):
            author (None | str):
            at (datetime.datetime):
            smart (list[str]):
     """

    sha: str
    message: str
    repository: str
    url: None | str
    author: None | str
    at: datetime.datetime
    smart: list[str]





    def to_dict(self) -> dict[str, Any]:
        sha = self.sha

        message = self.message

        repository = self.repository

        url: None | str
        url = self.url

        author: None | str
        author = self.author

        at = self.at.isoformat()

        smart = self.smart




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sha": sha,
            "message": message,
            "repository": repository,
            "url": url,
            "author": author,
            "at": at,
            "smart": smart,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        sha = d.pop("sha")

        message = d.pop("message")

        repository = d.pop("repository")

        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))


        def _parse_author(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        author = _parse_author(d.pop("author"))


        at = datetime.datetime.fromisoformat(d.pop("at"))




        smart = cast(list[str], d.pop("smart"))


        issue_development_commits_latest_item = cls(
            sha=sha,
            message=message,
            repository=repository,
            url=url,
            author=author,
            at=at,
            smart=smart,
        )

        return issue_development_commits_latest_item

