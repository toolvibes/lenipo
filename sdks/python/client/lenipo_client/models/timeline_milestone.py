from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="TimelineMilestone")



@_attrs_define
class TimelineMilestone:
    """ 
        Attributes:
            id (UUID):
            name (str):
            date (datetime.date):
            released (bool):
            issue_keys (list[str]):
     """

    id: UUID
    name: str
    date: datetime.date
    released: bool
    issue_keys: list[str]





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        date = self.date.isoformat()

        released = self.released

        issue_keys = self.issue_keys




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "date": date,
            "released": released,
            "issueKeys": issue_keys,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        date = datetime.date.fromisoformat(d.pop("date"))




        released = d.pop("released")

        issue_keys = cast(list[str], d.pop("issueKeys"))


        timeline_milestone = cls(
            id=id,
            name=name,
            date=date,
            released=released,
            issue_keys=issue_keys,
        )

        return timeline_milestone

