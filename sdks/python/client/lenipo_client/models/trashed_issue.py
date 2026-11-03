from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="TrashedIssue")



@_attrs_define
class TrashedIssue:
    """ 
        Attributes:
            key (str):
            summary (str):
            deleted_at (datetime.datetime):
            deleted_by (None | UserRef):
            subtasks (int):
     """

    key: str
    summary: str
    deleted_at: datetime.datetime
    deleted_by: None | UserRef
    subtasks: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        key = self.key

        summary = self.summary

        deleted_at = self.deleted_at.isoformat()

        deleted_by: dict[str, Any] | None
        if isinstance(self.deleted_by, UserRef):
            deleted_by = self.deleted_by.to_dict()
        else:
            deleted_by = self.deleted_by

        subtasks = self.subtasks


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "deletedAt": deleted_at,
            "deletedBy": deleted_by,
            "subtasks": subtasks,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        deleted_at = datetime.datetime.fromisoformat(d.pop("deletedAt"))




        def _parse_deleted_by(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                deleted_by_type_0 = UserRef.from_dict(data)



                return deleted_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        deleted_by = _parse_deleted_by(d.pop("deletedBy"))


        subtasks = d.pop("subtasks")

        trashed_issue = cls(
            key=key,
            summary=summary,
            deleted_at=deleted_at,
            deleted_by=deleted_by,
            subtasks=subtasks,
        )

        return trashed_issue

