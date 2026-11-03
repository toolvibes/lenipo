from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="BoardColumn")



@_attrs_define
class BoardColumn:
    """ 
        Attributes:
            id (UUID):
            name (str):
            status_ids (list[UUID]):
            wip_min (int | None):
            wip_max (int | None):
     """

    id: UUID
    name: str
    status_ids: list[UUID]
    wip_min: int | None
    wip_max: int | None





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        status_ids = []
        for status_ids_item_data in self.status_ids:
            status_ids_item = str(status_ids_item_data)
            status_ids.append(status_ids_item)



        wip_min: int | None
        wip_min = self.wip_min

        wip_max: int | None
        wip_max = self.wip_max


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "statusIds": status_ids,
            "wipMin": wip_min,
            "wipMax": wip_max,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        status_ids = []
        _status_ids = d.pop("statusIds")
        for status_ids_item_data in (_status_ids):
            status_ids_item = UUID(status_ids_item_data)



            status_ids.append(status_ids_item)


        def _parse_wip_min(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        wip_min = _parse_wip_min(d.pop("wipMin"))


        def _parse_wip_max(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        wip_max = _parse_wip_max(d.pop("wipMax"))


        board_column = cls(
            id=id,
            name=name,
            status_ids=status_ids,
            wip_min=wip_min,
            wip_max=wip_max,
        )

        return board_column

