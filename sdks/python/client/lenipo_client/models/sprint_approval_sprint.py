from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="SprintApprovalSprint")



@_attrs_define
class SprintApprovalSprint:
    """ 
        Attributes:
            id (UUID):
            name (str):
            board_id (UUID):
     """

    id: UUID
    name: str
    board_id: UUID





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        board_id = str(self.board_id)


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
        id = UUID(d.pop("id"))




        name = d.pop("name")

        board_id = UUID(d.pop("boardId"))




        sprint_approval_sprint = cls(
            id=id,
            name=name,
            board_id=board_id,
        )

        return sprint_approval_sprint

