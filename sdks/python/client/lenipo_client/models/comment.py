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





T = TypeVar("T", bound="Comment")



@_attrs_define
class Comment:
    """ 
        Attributes:
            id (UUID):
            author (None | UserRef):
            body (RichText | str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            edited (bool):
            internal (bool):
            can_edit (bool):
            can_delete (bool):
     """

    id: UUID
    author: None | UserRef
    body: RichText | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    edited: bool
    internal: bool
    can_edit: bool
    can_delete: bool





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

        updated_at = self.updated_at.isoformat()

        edited = self.edited

        internal = self.internal

        can_edit = self.can_edit

        can_delete = self.can_delete


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "author": author,
            "body": body,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "edited": edited,
            "internal": internal,
            "canEdit": can_edit,
            "canDelete": can_delete,
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




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        edited = d.pop("edited")

        internal = d.pop("internal")

        can_edit = d.pop("canEdit")

        can_delete = d.pop("canDelete")

        comment = cls(
            id=id,
            author=author,
            body=body,
            created_at=created_at,
            updated_at=updated_at,
            edited=edited,
            internal=internal,
            can_edit=can_edit,
            can_delete=can_delete,
        )

        return comment

