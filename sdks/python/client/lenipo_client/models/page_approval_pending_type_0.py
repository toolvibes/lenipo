from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.rich_text import RichText
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PageApprovalPendingType0")



@_attrs_define
class PageApprovalPendingType0:
    """ 
        Attributes:
            title (str):
            comment (str):
            author (None | UserRef):
            submitted_at (datetime.datetime):
            content (None | RichText | str):
     """

    title: str
    comment: str
    author: None | UserRef
    submitted_at: datetime.datetime
    content: None | RichText | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        title = self.title

        comment = self.comment

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        submitted_at = self.submitted_at.isoformat()

        content: dict[str, Any] | None | str
        if isinstance(self.content, RichText):
            content = self.content.to_dict()
        else:
            content = self.content


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "title": title,
            "comment": comment,
            "author": author,
            "submittedAt": submitted_at,
            "content": content,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        title = d.pop("title")

        comment = d.pop("comment")

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




        def _parse_content(data: object) -> None | RichText | str:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_output_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_output_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RichText | str, data)

        content = _parse_content(d.pop("content"))


        page_approval_pending_type_0 = cls(
            title=title,
            comment=comment,
            author=author,
            submitted_at=submitted_at,
            content=content,
        )

        return page_approval_pending_type_0

