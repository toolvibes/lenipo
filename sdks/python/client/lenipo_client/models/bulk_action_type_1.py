from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="BulkActionType1")



@_attrs_define
class BulkActionType1:
    """ 
        Attributes:
            type_ (Literal['transition']):
            status_id (UUID):
            resolution (str | Unset):
     """

    type_: Literal['transition']
    status_id: UUID
    resolution: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        status_id = str(self.status_id)

        resolution = self.resolution


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "statusId": status_id,
        })
        if resolution is not UNSET:
            field_dict["resolution"] = resolution

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['transition'] , d.pop("type"))
        if type_ != 'transition':
            raise ValueError(f"type must match const 'transition', got '{type_}'")

        status_id = UUID(d.pop("statusId"))




        resolution = d.pop("resolution", UNSET)

        bulk_action_type_1 = cls(
            type_=type_,
            status_id=status_id,
            resolution=resolution,
        )


        bulk_action_type_1.additional_properties = d
        return bulk_action_type_1

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
