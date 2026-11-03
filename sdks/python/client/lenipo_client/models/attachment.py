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





T = TypeVar("T", bound="Attachment")



@_attrs_define
class Attachment:
    """ 
        Attributes:
            id (UUID):
            file_name (str):
            content_type (str):
            size (int):
            image (bool):
            author (None | UserRef):
            created_at (datetime.datetime):
            url (str):
            can_delete (bool):
     """

    id: UUID
    file_name: str
    content_type: str
    size: int
    image: bool
    author: None | UserRef
    created_at: datetime.datetime
    url: str
    can_delete: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        file_name = self.file_name

        content_type = self.content_type

        size = self.size

        image = self.image

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        created_at = self.created_at.isoformat()

        url = self.url

        can_delete = self.can_delete


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "fileName": file_name,
            "contentType": content_type,
            "size": size,
            "image": image,
            "author": author,
            "createdAt": created_at,
            "url": url,
            "canDelete": can_delete,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        file_name = d.pop("fileName")

        content_type = d.pop("contentType")

        size = d.pop("size")

        image = d.pop("image")

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


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        url = d.pop("url")

        can_delete = d.pop("canDelete")

        attachment = cls(
            id=id,
            file_name=file_name,
            content_type=content_type,
            size=size,
            image=image,
            author=author,
            created_at=created_at,
            url=url,
            can_delete=can_delete,
        )

        return attachment

