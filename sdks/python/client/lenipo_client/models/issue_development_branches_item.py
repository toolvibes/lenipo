from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="IssueDevelopmentBranchesItem")



@_attrs_define
class IssueDevelopmentBranchesItem:
    """ 
        Attributes:
            name (str):
            repository (str):
            url (None | str):
            updated_at (datetime.datetime):
     """

    name: str
    repository: str
    url: None | str
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        repository = self.repository

        url: None | str
        url = self.url

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "repository": repository,
            "url": url,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        repository = d.pop("repository")

        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))


        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        issue_development_branches_item = cls(
            name=name,
            repository=repository,
            url=url,
            updated_at=updated_at,
        )

        return issue_development_branches_item

