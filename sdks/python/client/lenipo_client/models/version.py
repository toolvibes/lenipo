from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="Version")



@_attrs_define
class Version:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            start_date (datetime.date | None):
            release_date (datetime.date | None):
            released (bool):
            archived (bool):
            issue_count (int):
            open_count (int):
     """

    id: UUID
    name: str
    description: str
    start_date: datetime.date | None
    release_date: datetime.date | None
    released: bool
    archived: bool
    issue_count: int
    open_count: int





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        description = self.description

        start_date: None | str
        if isinstance(self.start_date, datetime.date):
            start_date = self.start_date.isoformat()
        else:
            start_date = self.start_date

        release_date: None | str
        if isinstance(self.release_date, datetime.date):
            release_date = self.release_date.isoformat()
        else:
            release_date = self.release_date

        released = self.released

        archived = self.archived

        issue_count = self.issue_count

        open_count = self.open_count


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "startDate": start_date,
            "releaseDate": release_date,
            "released": released,
            "archived": archived,
            "issueCount": issue_count,
            "openCount": open_count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        def _parse_start_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                start_date_type_0 = datetime.date.fromisoformat(data)



                return start_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        start_date = _parse_start_date(d.pop("startDate"))


        def _parse_release_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                release_date_type_0 = datetime.date.fromisoformat(data)



                return release_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        release_date = _parse_release_date(d.pop("releaseDate"))


        released = d.pop("released")

        archived = d.pop("archived")

        issue_count = d.pop("issueCount")

        open_count = d.pop("openCount")

        version = cls(
            id=id,
            name=name,
            description=description,
            start_date=start_date,
            release_date=release_date,
            released=released,
            archived=archived,
            issue_count=issue_count,
            open_count=open_count,
        )

        return version

