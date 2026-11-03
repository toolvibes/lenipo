from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="GadgetConfigType6")



@_attrs_define
class GadgetConfigType6:
    """ 
        Attributes:
            type_ (Literal['sprint-burndown']):
            board_id (UUID):
     """

    type_: Literal['sprint-burndown']
    board_id: UUID





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        board_id = str(self.board_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "boardId": board_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['sprint-burndown'] , d.pop("type"))
        if type_ != 'sprint-burndown':
            raise ValueError(f"type must match const 'sprint-burndown', got '{type_}'")

        board_id = UUID(d.pop("boardId"))




        gadget_config_type_6 = cls(
            type_=type_,
            board_id=board_id,
        )

        return gadget_config_type_6

