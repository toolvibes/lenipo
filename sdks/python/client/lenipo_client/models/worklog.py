from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Worklog")



@_attrs_define
class Worklog:
    """ 
        Attributes:
            id (UUID):
            author (None | UserRef):
            started (datetime.datetime):
            time_spent_seconds (int):
            comment (str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            can_edit (bool):
            can_delete (bool):
     """

    id: UUID
    author: None | UserRef
    started: datetime.datetime
    time_spent_seconds: int
    comment: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    can_edit: bool
    can_delete: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        started = self.started.isoformat()

        time_spent_seconds = self.time_spent_seconds

        comment = self.comment

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        can_edit = self.can_edit

        can_delete = self.can_delete


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "author": author,
            "started": started,
            "timeSpentSeconds": time_spent_seconds,
            "comment": comment,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "canEdit": can_edit,
            "canDelete": can_delete,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_author(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                author_type_0 = UserRef.from_dict(data)



                return author_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        author = _parse_author(d.pop("author"))


        started = datetime.datetime.fromisoformat(d.pop("started"))




        time_spent_seconds = d.pop("timeSpentSeconds")

        comment = d.pop("comment")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        can_edit = d.pop("canEdit")

        can_delete = d.pop("canDelete")

        worklog = cls(
            id=id,
            author=author,
            started=started,
            time_spent_seconds=time_spent_seconds,
            comment=comment,
            created_at=created_at,
            updated_at=updated_at,
            can_edit=can_edit,
            can_delete=can_delete,
        )

        return worklog

