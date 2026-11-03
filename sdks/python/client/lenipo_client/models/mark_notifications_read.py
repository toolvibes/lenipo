from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="MarkNotificationsRead")



@_attrs_define
class MarkNotificationsRead:
    """ 
        Attributes:
            ids (list[int] | Unset):
            all_ (bool | Unset):  Default: False.
     """

    ids: list[int] | Unset = UNSET
    all_: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ids: list[int] | Unset = UNSET
        if not isinstance(self.ids, Unset):
            ids = self.ids



        all_ = self.all_


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if ids is not UNSET:
            field_dict["ids"] = ids
        if all_ is not UNSET:
            field_dict["all"] = all_

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ids = cast(list[int], d.pop("ids", UNSET))


        all_ = d.pop("all", UNSET)

        mark_notifications_read = cls(
            ids=ids,
            all_=all_,
        )


        mark_notifications_read.additional_properties = d
        return mark_notifications_read

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
