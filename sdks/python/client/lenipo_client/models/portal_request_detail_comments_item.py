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
  from ..models.rich_text import RichText
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PortalRequestDetailCommentsItem")



@_attrs_define
class PortalRequestDetailCommentsItem:
    """ 
        Attributes:
            id (UUID):
            author (None | UserRef):
            body (RichText | str):
            created_at (datetime.datetime):
            from_agent (bool):
     """

    id: UUID
    author: None | UserRef
    body: RichText | str
    created_at: datetime.datetime
    from_agent: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        body: dict[str, Any] | str
        if isinstance(self.body, RichText):
            body = self.body.to_dict()
        else:
            body = self.body

        created_at = self.created_at.isoformat()

        from_agent = self.from_agent


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "author": author,
            "body": body,
            "createdAt": created_at,
            "fromAgent": from_agent,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
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


        def _parse_body(data: object) -> RichText | str:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_output_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_output_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(RichText | str, data)

        body = _parse_body(d.pop("body"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        from_agent = d.pop("fromAgent")

        portal_request_detail_comments_item = cls(
            id=id,
            author=author,
            body=body,
            created_at=created_at,
            from_agent=from_agent,
        )

        return portal_request_detail_comments_item

