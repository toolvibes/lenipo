from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.bulk_update_request_updates_item import BulkUpdateRequestUpdatesItem





T = TypeVar("T", bound="BulkUpdateRequest")



@_attrs_define
class BulkUpdateRequest:
    """ 
        Attributes:
            updates (list[BulkUpdateRequestUpdatesItem]):
            atomic (bool | Unset):  Default: False.
     """

    updates: list[BulkUpdateRequestUpdatesItem]
    atomic: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.bulk_update_request_updates_item import BulkUpdateRequestUpdatesItem # noqa: PLC0415
        updates = []
        for updates_item_data in self.updates:
            updates_item = updates_item_data.to_dict()
            updates.append(updates_item)



        atomic = self.atomic


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "updates": updates,
        })
        if atomic is not UNSET:
            field_dict["atomic"] = atomic

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bulk_update_request_updates_item import BulkUpdateRequestUpdatesItem # noqa: PLC0415
        d = dict(src_dict)
        updates = []
        _updates = d.pop("updates")
        for updates_item_data in (_updates):
            updates_item = BulkUpdateRequestUpdatesItem.from_dict(updates_item_data)



            updates.append(updates_item)


        atomic = d.pop("atomic", UNSET)

        bulk_update_request = cls(
            updates=updates,
            atomic=atomic,
        )


        bulk_update_request.additional_properties = d
        return bulk_update_request

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
