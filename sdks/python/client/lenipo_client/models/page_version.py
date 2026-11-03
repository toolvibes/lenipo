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





T = TypeVar("T", bound="PageVersion")



@_attrs_define
class PageVersion:
    """ 
        Attributes:
            number (int):
            title (str):
            author (None | UserRef):
            comment (str):
            restored_from (int | None):
            created_at (datetime.datetime):
            content (RichText | str):
     """

    number: int
    title: str
    author: None | UserRef
    comment: str
    restored_from: int | None
    created_at: datetime.datetime
    content: RichText | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        number = self.number

        title = self.title

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        comment = self.comment

        restored_from: int | None
        restored_from = self.restored_from

        created_at = self.created_at.isoformat()

        content: dict[str, Any] | str
        if isinstance(self.content, RichText):
            content = self.content.to_dict()
        else:
            content = self.content


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "number": number,
            "title": title,
            "author": author,
            "comment": comment,
            "restoredFrom": restored_from,
            "createdAt": created_at,
            "content": content,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        number = d.pop("number")

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


        comment = d.pop("comment")

        def _parse_restored_from(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        restored_from = _parse_restored_from(d.pop("restoredFrom"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_content(data: object) -> RichText | str:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_output_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_output_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(RichText | str, data)

        content = _parse_content(d.pop("content"))


        page_version = cls(
            number=number,
            title=title,
            author=author,
            comment=comment,
            restored_from=restored_from,
            created_at=created_at,
            content=content,
        )

        return page_version

