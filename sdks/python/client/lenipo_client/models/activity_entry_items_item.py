from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ActivityEntryItemsItem")



@_attrs_define
class ActivityEntryItemsItem:
    """ 
        Attributes:
            field (str):
            from_ (None | str):
            to (None | str):
     """

    field: str
    from_: None | str
    to: None | str





    def to_dict(self) -> dict[str, Any]:
        field = self.field

        from_: None | str
        from_ = self.from_

        to: None | str
        to = self.to


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "field": field,
            "from": from_,
            "to": to,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        field = d.pop("field")

        def _parse_from_(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_ = _parse_from_(d.pop("from"))


        def _parse_to(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        to = _parse_to(d.pop("to"))


        activity_entry_items_item = cls(
            field=field,
            from_=from_,
            to=to,
        )

        return activity_entry_items_item

