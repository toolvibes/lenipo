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





T = TypeVar("T", bound="BlogPost")



@_attrs_define
class BlogPost:
    """ 
        Attributes:
            id (UUID):
            title (str):
            space_key (str):
            published_at (datetime.datetime):
            author (None | UserRef):
            excerpt (str):
     """

    id: UUID
    title: str
    space_key: str
    published_at: datetime.datetime
    author: None | UserRef
    excerpt: str





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        title = self.title

        space_key = self.space_key

        published_at = self.published_at.isoformat()

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        excerpt = self.excerpt


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "spaceKey": space_key,
            "publishedAt": published_at,
            "author": author,
            "excerpt": excerpt,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        space_key = d.pop("spaceKey")

        published_at = datetime.datetime.fromisoformat(d.pop("publishedAt"))




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


        excerpt = d.pop("excerpt")

        blog_post = cls(
            id=id,
            title=title,
            space_key=space_key,
            published_at=published_at,
            author=author,
            excerpt=excerpt,
        )

        return blog_post

