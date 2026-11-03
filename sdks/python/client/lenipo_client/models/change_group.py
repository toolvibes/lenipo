from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.change_group_items_item import ChangeGroupItemsItem
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ChangeGroup")



@_attrs_define
class ChangeGroup:
    """ 
        Attributes:
            id (int):
            author (None | UserRef):
            via (str):
            created_at (datetime.datetime):
            items (list[ChangeGroupItemsItem]):
     """

    id: int
    author: None | UserRef
    via: str
    created_at: datetime.datetime
    items: list[ChangeGroupItemsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.change_group_items_item import ChangeGroupItemsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = self.id

        author: dict[str, Any] | None
        if isinstance(self.author, UserRef):
            author = self.author.to_dict()
        else:
            author = self.author

        via = self.via

        created_at = self.created_at.isoformat()

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "author": author,
            "via": via,
            "createdAt": created_at,
            "items": items,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.change_group_items_item import ChangeGroupItemsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

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


        via = d.pop("via")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = ChangeGroupItemsItem.from_dict(items_item_data)



            items.append(items_item)


        change_group = cls(
            id=id,
            author=author,
            via=via,
            created_at=created_at,
            items=items,
        )

        return change_group

