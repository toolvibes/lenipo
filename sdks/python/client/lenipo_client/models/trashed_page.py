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





T = TypeVar("T", bound="TrashedPage")



@_attrs_define
class TrashedPage:
    """ 
        Attributes:
            id (UUID):
            title (str):
            deleted_at (datetime.datetime):
            deleted_by (None | UserRef):
     """

    id: UUID
    title: str
    deleted_at: datetime.datetime
    deleted_by: None | UserRef





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        title = self.title

        deleted_at = self.deleted_at.isoformat()

        deleted_by: dict[str, Any] | None
        if isinstance(self.deleted_by, UserRef):
            deleted_by = self.deleted_by.to_dict()
        else:
            deleted_by = self.deleted_by


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "deletedAt": deleted_at,
            "deletedBy": deleted_by,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

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


        trashed_page = cls(
            id=id,
            title=title,
            deleted_at=deleted_at,
            deleted_by=deleted_by,
        )

        return trashed_page

