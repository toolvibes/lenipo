from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_development_builds_item_state import IssueDevelopmentBuildsItemState
from typing import cast
import datetime






T = TypeVar("T", bound="IssueDevelopmentBuildsItem")



@_attrs_define
class IssueDevelopmentBuildsItem:
    """ 
        Attributes:
            name (str):
            repository (str):
            url (None | str):
            state (IssueDevelopmentBuildsItemState):
            updated_at (datetime.datetime):
     """

    name: str
    repository: str
    url: None | str
    state: IssueDevelopmentBuildsItemState
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        repository = self.repository

        url: None | str
        url = self.url

        state = self.state.value

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "repository": repository,
            "url": url,
            "state": state,
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


        state = IssueDevelopmentBuildsItemState(d.pop("state"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        issue_development_builds_item = cls(
            name=name,
            repository=repository,
            url=url,
            state=state,
            updated_at=updated_at,
        )

        return issue_development_builds_item

