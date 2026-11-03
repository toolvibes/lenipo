from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.notification_details_kind import NotificationDetailsKind
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.notification_details_items_item import NotificationDetailsItemsItem





T = TypeVar("T", bound="NotificationDetails")



@_attrs_define
class NotificationDetails:
    """ 
        Attributes:
            kind (NotificationDetailsKind):
            items (list[NotificationDetailsItemsItem]):
            excerpt (str | Unset):
            quote (str | Unset):
            version (int | Unset):
     """

    kind: NotificationDetailsKind
    items: list[NotificationDetailsItemsItem]
    excerpt: str | Unset = UNSET
    quote: str | Unset = UNSET
    version: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.notification_details_items_item import NotificationDetailsItemsItem # noqa: PLC0415
        kind = self.kind.value

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        excerpt = self.excerpt

        quote = self.quote

        version = self.version


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "items": items,
        })
        if excerpt is not UNSET:
            field_dict["excerpt"] = excerpt
        if quote is not UNSET:
            field_dict["quote"] = quote
        if version is not UNSET:
            field_dict["version"] = version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification_details_items_item import NotificationDetailsItemsItem # noqa: PLC0415
        d = dict(src_dict)
        kind = NotificationDetailsKind(d.pop("kind"))




        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = NotificationDetailsItemsItem.from_dict(items_item_data)



            items.append(items_item)


        excerpt = d.pop("excerpt", UNSET)

        quote = d.pop("quote", UNSET)

        version = d.pop("version", UNSET)

        notification_details = cls(
            kind=kind,
            items=items,
            excerpt=excerpt,
            quote=quote,
            version=version,
        )

        return notification_details

