from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateBoardRequestColumnsItem")



@_attrs_define
class UpdateBoardRequestColumnsItem:
    """ 
        Attributes:
            name (str):
            status_ids (list[UUID]):
            id (UUID | Unset):
            wip_min (int | None | Unset):
            wip_max (int | None | Unset):
     """

    name: str
    status_ids: list[UUID]
    id: UUID | Unset = UNSET
    wip_min: int | None | Unset = UNSET
    wip_max: int | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        status_ids = []
        for status_ids_item_data in self.status_ids:
            status_ids_item = str(status_ids_item_data)
            status_ids.append(status_ids_item)



        id: str | Unset = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)

        wip_min: int | None | Unset
        if isinstance(self.wip_min, Unset):
            wip_min = UNSET
        else:
            wip_min = self.wip_min

        wip_max: int | None | Unset
        if isinstance(self.wip_max, Unset):
            wip_max = UNSET
        else:
            wip_max = self.wip_max


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "statusIds": status_ids,
        })
        if id is not UNSET:
            field_dict["id"] = id
        if wip_min is not UNSET:
            field_dict["wipMin"] = wip_min
        if wip_max is not UNSET:
            field_dict["wipMax"] = wip_max

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        status_ids = []
        _status_ids = d.pop("statusIds")
        for status_ids_item_data in (_status_ids):
            status_ids_item = UUID(status_ids_item_data)



            status_ids.append(status_ids_item)


        _id = d.pop("id", UNSET)
        id: UUID | Unset
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        def _parse_wip_min(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        wip_min = _parse_wip_min(d.pop("wipMin", UNSET))


        def _parse_wip_max(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        wip_max = _parse_wip_max(d.pop("wipMax", UNSET))


        update_board_request_columns_item = cls(
            name=name,
            status_ids=status_ids,
            id=id,
            wip_min=wip_min,
            wip_max=wip_max,
        )


        update_board_request_columns_item.additional_properties = d
        return update_board_request_columns_item

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
