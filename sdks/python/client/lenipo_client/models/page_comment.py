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
  from ..models.page_comment_resolved_type_0 import PageCommentResolvedType0
  from ..models.rich_text import RichText
  from ..models.text_anchor import TextAnchor
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PageComment")



@_attrs_define
class PageComment:
    """ 
        Attributes:
            id (UUID):
            parent_id (None | UUID):
            author (None | UserRef):
            body (None | RichText | str):
            anchor (None | TextAnchor):
            detached (bool):
            resolved (None | PageCommentResolvedType0):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            edited (bool):
            deleted (bool):
            can_edit (bool):
            can_delete (bool):
     """

    id: UUID
    parent_id: None | UUID
    author: None | UserRef
    body: None | RichText | str
    anchor: None | TextAnchor
    detached: bool
    resolved: None | PageCommentResolvedType0
    created_at: datetime.datetime
    updated_at: datetime.datetime
    edited: bool
    deleted: bool
    can_edit: bool
    can_delete: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_comment_resolved_type_0 import PageCommentResolvedType0 # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.text_anchor import TextAnchor # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        parent_id: None | str
        if isinstance(self.parent_id, UUID):
            parent_id = str(self.parent_id)
        else:
            parent_id = self.parent_id

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        body: dict[str, Any] | None | str
        if isinstance(self.body, RichText):
            body = self.body.to_dict()
        else:
            body = self.body

        anchor: dict[str, Any] | None
        if isinstance(self.anchor, TextAnchor):
            anchor = self.anchor.to_dict()
        else:
            anchor = self.anchor

        detached = self.detached

        resolved: dict[str, Any] | None
        if isinstance(self.resolved, PageCommentResolvedType0):
            resolved = self.resolved.to_dict()
        else:
            resolved = self.resolved

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        edited = self.edited

        deleted = self.deleted

        can_edit = self.can_edit

        can_delete = self.can_delete


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "parentId": parent_id,
            "author": author,
            "body": body,
            "anchor": anchor,
            "detached": detached,
            "resolved": resolved,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "edited": edited,
            "deleted": deleted,
            "canEdit": can_edit,
            "canDelete": can_delete,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_comment_resolved_type_0 import PageCommentResolvedType0 # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.text_anchor import TextAnchor # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_parent_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parent_id_type_0 = UUID(data)



                return parent_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        parent_id = _parse_parent_id(d.pop("parentId"))


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


        def _parse_body(data: object) -> None | RichText | str:
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

        body = _parse_body(d.pop("body"))


        def _parse_anchor(data: object) -> None | TextAnchor:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                anchor_type_0 = TextAnchor.from_dict(data)



                return anchor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TextAnchor, data)

        anchor = _parse_anchor(d.pop("anchor"))


        detached = d.pop("detached")

        def _parse_resolved(data: object) -> None | PageCommentResolvedType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resolved_type_0 = PageCommentResolvedType0.from_dict(data)



                return resolved_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PageCommentResolvedType0, data)

        resolved = _parse_resolved(d.pop("resolved"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        edited = d.pop("edited")

        deleted = d.pop("deleted")

        can_edit = d.pop("canEdit")

        can_delete = d.pop("canDelete")

        page_comment = cls(
            id=id,
            parent_id=parent_id,
            author=author,
            body=body,
            anchor=anchor,
            detached=detached,
            resolved=resolved,
            created_at=created_at,
            updated_at=updated_at,
            edited=edited,
            deleted=deleted,
            can_edit=can_edit,
            can_delete=can_delete,
        )

        return page_comment

