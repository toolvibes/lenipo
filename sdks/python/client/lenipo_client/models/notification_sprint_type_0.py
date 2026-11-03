from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="NotificationSprintType0")



@_attrs_define
class NotificationSprintType0:
    """ 
        Attributes:
            id (str):
            name (str):
            board_id (str):
     """

    id: str
    name: str
    board_id: str





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        board_id = self.board_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "boardId": board_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        board_id = d.pop("boardId")

        notification_sprint_type_0 = cls(
            id=id,
            name=name,
            board_id=board_id,
        )

        return notification_sprint_type_0

