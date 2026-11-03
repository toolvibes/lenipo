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





T = TypeVar("T", bound="PendingApproval")



@_attrs_define
class PendingApproval:
    """ 
        Attributes:
            page_id (UUID):
            title (str):
            author (None | UserRef):
            submitted_at (datetime.datetime):
     """

    page_id: UUID
    title: str
    author: None | UserRef
    submitted_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        page_id = str(self.page_id)

        title = self.title

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        submitted_at = self.submitted_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "pageId": page_id,
            "title": title,
            "author": author,
            "submittedAt": submitted_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        page_id = UUID(d.pop("pageId"))




        title = d.pop("title")

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


        submitted_at = datetime.datetime.fromisoformat(d.pop("submittedAt"))




        pending_approval = cls(
            page_id=page_id,
            title=title,
            author=author,
            submitted_at=submitted_at,
        )

        return pending_approval

